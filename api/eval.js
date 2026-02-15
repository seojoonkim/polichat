import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 30,
};

const EVAL_PROMPT = `あなたは日本語ネイティブ水準の品質評価者です。以下のアイドルチャット応答を5つの軸で採点してください。

## 【重要】ペルソナ固有表現ホワイトリスト
以下は標準日本語としては非典型だが、矢吹奈子本人がラジオ(レコメン!)等で実際に使用する固有表現です。
これらは減点対象外とし、むしろペルソナ適合性でプラス評価してください：

- 「成長期のお坊さん」（大食い時の自虐表現）
- 「反省はしてないんですけど正直に」（語順非標準だが本人の癖）
- 「出き」「野の時期」（食欲周期の自称）
- 文末「みたいな」の多用（ヘッジング、125回/放送）
- 「～んですけど」の連鎖によるランオン文（本人の話し方の特徴）
- 「じゃないですか？」「すごくないですか？」の多用（共感を求める修辞疑問）
- 「なんか」「めっちゃ」「本当に」の頻用（3大フィラー、427回/放送）
- 「で、」「でね」による文の連結（サーガチェイニング）

## 評価軸 (各1-5点、合計25点満点)

### 1. 語彙の正確性 (Lexical Accuracy)
- 存在しない慣用句・コロケーションの生成をチェック
- ※ホワイトリストの表現は減点しない

### 2. 文法の自然さ (Grammatical Naturalness)  
- 語順、助詞、終助詞、敬語↔タメ口の切り替え
- ※ホワイトリストの語順パターンは減点しない

### 3. 文体の一貫性 (Stylistic Consistency)
- 笑い表現(www/笑/草)の混在チェック
- 絵文字頻度の一貫性
- ※www系か笑系、どちらか一方に統一されていればOK

### 4. ペルソナ適合性 (Persona Fidelity)
- 20代前半アイドルの距離感
- 一人称・二人称の安定性（公式では「私」統一）
- ホワイトリストの表現を自然に使っていればプラス評価

### 5. 構造の完結性 (Structural Completeness)
- 文中断の有無
- 話題導入→展開→締めの流れ
- ※ランオン文でも最終的に完結していればOK

## 出力形式 (JSON only, no markdown)
{
  "lexical_accuracy": { "score": 0, "issues": [] },
  "grammatical_naturalness": { "score": 0, "issues": [] },
  "stylistic_consistency": { "score": 0, "issues": [] },
  "persona_fidelity": { "score": 0, "issues": [] },
  "structural_completeness": { "score": 0, "issues": [] },
  "total": 0,
  "grade": "A|B|C|D|F",
  "corrections": [
    { "original": "問題のある文", "fixed": "修正案", "reason": "理由" }
  ]
}

グレード基準: A(23-25) B(18-22) C(13-17) D(8-12) F(5-7)

JSONのみを出力してください。マークダウンのコードブロックは使用しないでください。`;

// 등급 계산
function calculateGrade(total) {
  if (total >= 23) return 'A';
  if (total >= 18) return 'B';
  if (total >= 13) return 'C';
  if (total >= 8) return 'D';
  return 'F';
}

// JSON 파싱 (마크다운 코드블록 처리)
function parseEvalResult(text) {
  // 마크다운 코드블록 제거
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();
  
  return JSON.parse(cleaned);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { 
    response_text, 
    idol_id, 
    user_id, 
    model_used,
    stop_reason 
  } = req.body;

  if (!response_text) {
    return res.status(400).json({ error: 'response_text is required' });
  }

  // Supabase 클라이언트
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

  try {
    // Claude Haiku로 eval 실행
    const evalResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `以下のアイドルチャット応答を評価してください:\n\n---\n${response_text}\n---`,
          },
        ],
        system: EVAL_PROMPT,
      }),
    });

    if (!evalResponse.ok) {
      const errText = await evalResponse.text();
      console.error('Eval API error:', errText);
      return res.status(500).json({ error: `Eval API error: ${evalResponse.status}` });
    }

    const evalData = await evalResponse.json();
    const evalText = evalData.content?.[0]?.text || '';

    // JSON 파싱
    let evalResult;
    try {
      evalResult = parseEvalResult(evalText);
    } catch (parseError) {
      console.error('Eval JSON parse error:', parseError, 'Raw:', evalText);
      return res.status(500).json({ error: 'Failed to parse eval result', raw: evalText });
    }

    // 등급 및 플래그 계산
    const total = evalResult.total || 0;
    const grade = evalResult.grade || calculateGrade(total);
    const flagged = total <= 17; // C등급 이하 (13-17점 이하)

    // Supabase에 저장
    if (supabase) {
      try {
        await supabase.from('eval_logs').insert({
          idol_id: idol_id || 'unknown',
          user_id: user_id || null,
          response_text,
          eval_result: evalResult,
          total_score: total,
          grade,
          flagged,
          model_used: model_used || null,
          stop_reason: stop_reason || null,
        });
      } catch (dbError) {
        console.error('Supabase insert error:', dbError);
        // DB 에러는 무시하고 결과는 반환
      }
    }

    // 결과 반환
    return res.status(200).json({
      success: true,
      eval_result: evalResult,
      total_score: total,
      grade,
      flagged,
      stop_reason,
    });
  } catch (error) {
    console.error('Eval handler error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}
