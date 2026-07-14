import fs from "fs";
import path from "path";
import OpenAI from "openai";
import * as XLSX from "xlsx";

export const maxDuration = 60;

interface PastLifeRecord {
  번호: number;
  "전생의 직업 또는 존재": string;
  시대: string;
  사인: string;
  "전생의 업적": string;
  "사람들의 기억": string;
}

let recordsCache: PastLifeRecord[] | null = null;

function loadRecords(): PastLifeRecord[] {
  if (!recordsCache) {
    const filePath = path.join(process.cwd(), "data", "past-lives.xlsx");
    const workbook = XLSX.read(fs.readFileSync(filePath));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    recordsCache = XLSX.utils.sheet_to_json<PastLifeRecord>(sheet);
  }
  return recordsCache;
}

// 같은 이름은 항상 같은 전생이 나오도록 결정적 해시(djb2 변형)를 사용
function hashName(name: string): number {
  let hash = 5381;
  for (const ch of name) {
    hash = ((hash * 33) ^ ch.codePointAt(0)!) >>> 0;
  }
  return hash;
}

// 매 요청마다 랜덤으로 하나 뽑히는 작문 뉘앙스
const TONES: { label: string; direction: string }[] = [
  {
    label: "감동 휴먼 다큐멘터리",
    direction:
      "휴먼 다큐멘터리 내레이션처럼 잔잔하게 시작해 점점 뭉클해지는 어조. 삶의 애환과 위대함을 조명하고, 읽는 사람의 눈시울이 시큰해지게 쓴다. 마지막 문장에서 여운을 남긴다.",
  },
  {
    label: "완전 병맛 코미디",
    direction:
      "밑도 끝도 없는 병맛 개그 톤. 과장, 뜬금없는 디테일, 어이없는 자부심을 총동원한다. 진지한 척하다가 갑자기 무너지는 완급 조절로 웃음을 유발한다. 단, 비속어는 쓰지 않는다.",
  },
  {
    label: "장엄한 사극 내레이션",
    direction:
      "대하 사극의 장엄한 내레이션체. '~하였으니', '~였더라' 같은 고풍스러운 어미를 쓰고, 사소한 일도 천하의 대사처럼 웅장하게 서술한다.",
  },
  {
    label: "무협지 전설 모드",
    direction:
      "무협지 문체. 강호, 절세고수, 비급 같은 무협 용어로 전생을 전설의 고수 서사로 풀어낸다. 별호(별명)를 하나 지어주고 그 별호로 서사를 이끈다.",
  },
  {
    label: "긴급 탐사보도 뉴스",
    direction:
      "탐사보도 기자의 단독 보도 톤. '단독 입수', '취재 결과' 같은 보도 문구를 쓰며 전생 기록을 특종처럼 파헤친다. 목격자 증언(따옴표 인용)을 한두 개 지어내 삽입한다.",
  },
  {
    label: "영화 예고편 내레이션",
    direction:
      "블록버스터 영화 예고편 내레이션체. 짧고 강렬한 문장, 극적인 전환, '올여름' 대신 '그 시대'를 쓰는 스케일 큰 어조. 중간에 평론가 한 줄 평을 지어내 삽입한다.",
  },
  {
    label: "새벽 감성 라디오 DJ",
    direction:
      "새벽 2시 라디오 DJ가 청취자 사연을 읽어주듯 나긋나긋하고 감성적인 어조. 청취자(이름의 주인)에게 말을 건네듯 쓰고, 중간에 노래 한 곡을 신청곡처럼 언급한다.",
  },
  {
    label: "흥분한 스포츠 중계",
    direction:
      "결승전 마지막 순간을 중계하는 캐스터와 해설위원 톤. 느낌표를 아끼지 않고, 전생의 순간순간을 스포츠 하이라이트처럼 숨가쁘게 중계한다.",
  },
  {
    label: "미스터리 스릴러",
    direction:
      "미스터리 스릴러 소설의 도입부처럼 의문과 긴장감을 깔고 시작한다. 사인(死因)을 미스터리의 핵심 단서처럼 다루다가, 마지막에 허무하지만 웃긴 진상을 공개한다.",
  },
  {
    label: "잔잔한 서정 에세이",
    direction:
      "계절과 풍경 묘사가 살아있는 서정적 에세이체. 은유와 비유를 아끼지 않고, 전생의 삶을 한 편의 시처럼 아름답게 그려낸다.",
  },
];

// gpt-5.5가 계정에서 지원되지 않을 경우를 대비한 폴백 순서
const MODEL_CANDIDATES = [
  process.env.OPENAI_MODEL ?? "gpt-5.5",
  "gpt-5.1",
  "gpt-5",
  "gpt-4o-mini",
].filter((m, i, arr) => arr.indexOf(m) === i);

let workingModel: string | null = null;

async function writeStory(
  openai: OpenAI,
  name: string,
  record: PastLifeRecord,
  tone: { label: string; direction: string }
): Promise<{ story: string; model: string } | null> {
  const models = workingModel ? [workingModel] : MODEL_CANDIDATES;

  for (const model of models) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: [
              "너는 전생 기록 보관소의 수석 작가다.",
              "사용자의 이름과 전생 기록의 뼈대(직업/존재, 시대, 사인, 업적, 사람들의 기억)가 주어진다.",
              "이 뼈대를 소재로 삼아, 지정된 뉘앙스(문체)로 그 사람의 전생 이야기를 한 편 작문한다.",
              "",
              "규칙:",
              "- 한국어로 쓴다.",
              "- 분량은 공백 포함 500~800자. 이 범위를 반드시 지킨다.",
              "- 뼈대의 다섯 가지 사실(직업/존재, 시대, 사인, 업적, 기억)을 모두 이야기에 녹여낸다.",
              "- 뼈대에 없는 디테일(일상, 대사, 장면)은 뉘앙스에 맞게 자유롭게 지어내되, 뼈대의 사실과 모순되면 안 된다.",
              "- 2~4개의 문단으로 나눈다.",
              "- 마지막 문단에서 전생의 흔적이 현생의 그 사람에게 어떻게 남았을지로 마무리한다.",
              "- 제목, 머리말, 따옴표 감싸기 없이 본문만 출력한다.",
              "- 이것은 오락용 창작이며 실제 예언이나 점술이 아니다.",
            ].join("\n"),
          },
          {
            role: "user",
            content: [
              `이름: ${name}`,
              "",
              "[전생 기록 뼈대]",
              `- 전생의 직업 또는 존재: ${record["전생의 직업 또는 존재"]}`,
              `- 시대: ${record.시대}`,
              `- 사인: ${record.사인}`,
              `- 전생의 업적: ${record["전생의 업적"]}`,
              `- 사람들의 기억: ${record["사람들의 기억"]}`,
              "",
              `[이번 작문의 뉘앙스: ${tone.label}]`,
              tone.direction,
            ].join("\n"),
          },
        ],
        max_completion_tokens: 6000,
      });

      const story = completion.choices[0]?.message?.content?.trim();
      if (story) {
        workingModel = model;
        return { story, model };
      }
    } catch (err) {
      // 모델이 존재하지 않거나 접근 불가한 경우 다음 후보로 폴백
      if (err instanceof OpenAI.APIError && (err.status === 404 || err.status === 403 || err.status === 400)) {
        console.warn(`모델 "${model}" 사용 불가 (${err.status}), 다음 후보 시도`);
        continue;
      }
      console.error("OpenAI API error:", err);
      return null;
    }
  }
  return null;
}

export async function POST(req: Request) {
  let name: unknown;
  try {
    ({ name } = await req.json());
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (typeof name !== "string" || !name.trim() || name.trim().length > 20) {
    return Response.json(
      { error: "이름을 1~20자로 입력해주세요." },
      { status: 400 }
    );
  }

  const trimmedName = name.trim();

  let records: PastLifeRecord[];
  try {
    records = loadRecords();
  } catch (err) {
    console.error("전생 데이터 로드 실패:", err);
    return Response.json(
      { error: "전생 기록 데이터를 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  if (records.length === 0) {
    return Response.json({ error: "전생 기록이 비어 있습니다." }, { status: 500 });
  }

  // 전생 자체는 이름으로 결정, 작문 뉘앙스는 매번 랜덤
  const record = records[hashName(trimmedName) % records.length];
  const tone = TONES[Math.floor(Math.random() * TONES.length)];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "서버에 OPENAI_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const openai = new OpenAI({ apiKey });
  const result = await writeStory(openai, trimmedName, record, tone);

  if (!result) {
    return Response.json(
      { error: "전생 작문에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 502 }
    );
  }

  return Response.json({
    name: trimmedName,
    tone: tone.label,
    story: result.story,
    model: result.model,
    record: {
      being: record["전생의 직업 또는 존재"],
      era: record.시대,
      death: record.사인,
      achievement: record["전생의 업적"],
      memory: record["사람들의 기억"],
    },
  });
}
