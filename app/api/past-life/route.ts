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
  record: PastLifeRecord
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
              "너는 재치 있는 전생 이야기꾼이다.",
              "사용자의 이름과 전생 기록(직업/존재, 시대, 사인, 업적, 사람들의 기억)이 주어진다.",
              "이 기록을 바탕으로 그 사람에게 들려주는 짧은 전생 총평을 쓴다.",
              "규칙:",
              "- 한국어, 2~3문장, 120자 이내.",
              "- 전생의 특징이 현생의 성격이나 습관에 어떤 흔적으로 남았을지 유머러스하게 연결한다.",
              "- 기록에 있는 사실만 사용하고 새로운 설정을 추가하지 않는다.",
              "- 따옴표나 머리말 없이 본문만 쓴다.",
            ].join("\n"),
          },
          {
            role: "user",
            content: [
              `이름: ${name}`,
              `전생의 직업 또는 존재: ${record["전생의 직업 또는 존재"]}`,
              `시대: ${record.시대}`,
              `사인: ${record.사인}`,
              `전생의 업적: ${record["전생의 업적"]}`,
              `사람들의 기억: ${record["사람들의 기억"]}`,
            ].join("\n"),
          },
        ],
        max_completion_tokens: 2000,
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

  const record = records[hashName(trimmedName) % records.length];

  // GPT 총평은 부가 요소: 실패해도 전생 기록 자체는 항상 반환한다
  let story: string | null = null;
  let model: string | null = null;
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    const openai = new OpenAI({ apiKey });
    const result = await writeStory(openai, trimmedName, record);
    if (result) {
      story = result.story;
      model = result.model;
    }
  }

  return Response.json({
    name: trimmedName,
    record: {
      being: record["전생의 직업 또는 존재"],
      era: record.시대,
      death: record.사인,
      achievement: record["전생의 업적"],
      memory: record["사람들의 기억"],
    },
    story,
    model,
  });
}
