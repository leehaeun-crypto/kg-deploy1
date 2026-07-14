import OpenAI from "openai";

export const maxDuration = 60;

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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "서버에 OPENAI_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-5.5";

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: [
            "너는 재치 있는 전생 이야기꾼이다.",
            "사용자가 이름을 주면 그 사람의 전생을 상상해서 재미있게 들려준다.",
            "규칙:",
            "- 한국어로 쓴다.",
            "- 시대와 장소, 직업(또는 존재)을 구체적으로 정한다. 사람이 아닐 수도 있다(동물, 사물 등).",
            "- 전생의 성격이나 습관이 현생에 어떤 흔적으로 남았는지 유머러스하게 연결한다.",
            "- 3~4개의 짧은 문단, 전체 300~500자 내외.",
            "- 마지막 문장은 가벼운 덕담이나 반전으로 마무리한다.",
            "- 이것은 오락용 이야기이며 실제 예언이나 점술이 아니다.",
          ].join("\n"),
        },
        {
          role: "user",
          content: `"${name.trim()}"님의 전생 이야기를 들려줘.`,
        },
      ],
      temperature: 1.0,
      max_tokens: 1000,
    });

    const story = completion.choices[0]?.message?.content?.trim();
    if (!story) {
      return Response.json(
        { error: "이야기를 생성하지 못했습니다. 다시 시도해주세요." },
        { status: 502 }
      );
    }

    return Response.json({ story });
  } catch (err) {
    console.error("OpenAI API error:", err);
    const message =
      err instanceof OpenAI.APIError
        ? `OpenAI API 오류 (${err.status}): ${err.message}`
        : "전생을 불러오는 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 502 });
  }
}
