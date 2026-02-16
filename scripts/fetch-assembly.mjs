#!/usr/bin/env node
// 국회 오픈API → Supabase 적재 스크립트

const SUPABASE_URL = 'https://kjraibhawvbdftvcddpb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqcmFpYmhhd3ZiZGZ0dmNkZHBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTIzMTAsImV4cCI6MjA4NjgyODMxMH0.2YNzjI590E8MquAfj7wPMEZOMGEAvZK7W0uggkBO24U';

const POLITICIANS = {
  '이재명': 'leejm',
  '정청래': 'jungcr',
  '장동혁': 'jangdh',
  '오세훈': 'ohsehoon',
  '정원오': 'jungwono',
};

const BASE = 'https://open.assembly.go.kr/portal/openapi';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function apiFetch(apiCode, params = {}) {
  const url = new URL(`${BASE}/${apiCode}`);
  url.searchParams.set('Type', 'json');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  
  const res = await fetch(url.toString(), { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const data = await res.json();
  if (data.RESULT) return { rows: [], total: 0, msg: data.RESULT.MESSAGE };
  const wrapper = data[apiCode];
  if (!wrapper?.[1]?.row) return { rows: [], total: 0 };
  return { rows: wrapper[1].row, total: wrapper[0].head[0].list_total_count };
}

async function supabaseInsert(records) {
  if (!records.length) return 0;
  let ok = 0;
  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/politician_speeches`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) console.error(`  ❌ Supabase ${res.status}: ${await res.text()}`);
    else ok += batch.length;
  }
  return ok;
}

async function fetchAllPages(apiCode, params, maxPages = 100) {
  const all = [];
  for (let p = 1; p <= maxPages; p++) {
    const { rows, total } = await apiFetch(apiCode, { ...params, pIndex: String(p), pSize: '5' });
    if (!rows.length) break;
    all.push(...rows);
    if (all.length >= total || rows.length < 5) break;
    await sleep(150);
  }
  return all;
}

async function main() {
  const summary = {};
  const allRecords = [];

  // 1. 프로필
  console.log('📋 1. 국회의원 인적사항');
  const foundMembers = [];
  
  for (const [name, pid] of Object.entries(POLITICIANS)) {
    const { rows } = await apiFetch('nwvrqwxyaytdsfvhu', { HG_NM: name, pIndex: '1', pSize: '5' });
    if (!rows.length) {
      console.log(`  ⚠️ ${name}: 현재 국회의원 아님 → 스킵`);
      summary[name] = { profile: 0, bills: 0, votes: 0, status: '비의원' };
      continue;
    }
    const r = rows[0];
    foundMembers.push(name);
    summary[name] = { profile: 1, bills: 0, votes: 0, status: `${r.POLY_NM} ${r.ORIG_NM}` };
    allRecords.push({
      politician_id: pid, source: 'assembly_profile',
      content: `${name} (${r.POLY_NM}, ${r.ORIG_NM}) - ${r.REELE_GBN_NM}\n위원회: ${r.CMIT_NM}\n연락처: ${r.TEL_NO}\n이메일: ${r.E_MAIL}\n\n경력:\n${(r.MEM_TITLE || '').replace(/&middot;/g, '·')}`,
      metadata: { api: 'nwvrqwxyaytdsfvhu', party: r.POLY_NM, district: r.ORIG_NM, committee: r.CMIT_NM, reelection: r.REELE_GBN_NM, mona_cd: r.MONA_CD },
    });
    console.log(`  ✅ ${name}: ${r.POLY_NM} ${r.ORIG_NM} (${r.REELE_GBN_NM})`);
    await sleep(200);
  }

  // 2. 발의법률안 — PROPOSER 필터로 각 의원 검색
  console.log('\n📋 2. 발의법률안 (22대)');
  
  for (const name of foundMembers) {
    const pid = POLITICIANS[name];
    const rows = await fetchAllPages('nzmimeepazxkubdpn', { AGE: '22', PROPOSER: name });
    
    for (const r of rows) {
      const isMain = r.RST_PROPOSER === name;
      allRecords.push({
        politician_id: pid, source: 'assembly_bills',
        content: `[${isMain ? '대표발의' : '공동발의'}] ${r.BILL_NAME} (${r.BILL_NO})\n발의일: ${r.PROPOSE_DT}\n대표발의자: ${r.RST_PROPOSER}\n위원회: ${r.COMMITTEE || '미배정'}\n처리결과: ${r.PROC_RESULT || '계류중'}`,
        metadata: { api: 'nzmimeepazxkubdpn', bill_id: r.BILL_ID, bill_no: r.BILL_NO, bill_name: r.BILL_NAME, propose_dt: r.PROPOSE_DT, is_main_proposer: isMain, proc_result: r.PROC_RESULT },
      });
    }
    summary[name].bills = rows.length;
    console.log(`  ${name}: ${rows.length}건`);
  }

  // 이재명은 의원은 아니지만 대표발의 법안이 있을 수 있음 (22대 초기)
  for (const name of Object.keys(POLITICIANS)) {
    if (foundMembers.includes(name)) continue;
    const pid = POLITICIANS[name];
    const rows = await fetchAllPages('nzmimeepazxkubdpn', { AGE: '22', PROPOSER: name });
    if (rows.length) {
      for (const r of rows) {
        allRecords.push({
          politician_id: pid, source: 'assembly_bills',
          content: `[${r.RST_PROPOSER === name ? '대표발의' : '공동발의'}] ${r.BILL_NAME} (${r.BILL_NO})\n발의일: ${r.PROPOSE_DT}\n대표발의자: ${r.RST_PROPOSER}\n처리결과: ${r.PROC_RESULT || '계류중'}`,
          metadata: { api: 'nzmimeepazxkubdpn', bill_id: r.BILL_ID, bill_no: r.BILL_NO, bill_name: r.BILL_NAME, propose_dt: r.PROPOSE_DT, is_main_proposer: r.RST_PROPOSER === name },
        });
      }
      summary[name].bills = rows.length;
      console.log(`  ${name} (비의원): 법안 ${rows.length}건 발견`);
    }
  }

  // 3. 본회의 표결정보
  console.log('\n📋 3. 본회의 표결정보');
  const voteRows = await fetchAllPages('nwbpacrgavhjryiph', { AGE: '22' }, 200);
  
  for (const r of voteRows) {
    allRecords.push({
      politician_id: 'assembly_general', source: 'assembly_votes',
      content: `[본회의 표결] ${r.BILL_NM}\n발의자: ${r.PROPOSER}\n위원회: ${r.COMMITTEE_NM}\n결과: ${r.PROC_RESULT_CD}\n총투표: ${r.VOTE_TCNT}명, 찬성: ${r.YES_TCNT}, 반대: ${r.NO_TCNT || 0}, 기권: ${r.BLANK_TCNT || 0}`,
      metadata: { api: 'nwbpacrgavhjryiph', bill_no: r.BILL_NO, proc_result: r.PROC_RESULT_CD },
    });
  }
  console.log(`  표결 ${voteRows.length}건`);

  // Insert
  console.log(`\n💾 Supabase 적재 (${allRecords.length}건)...`);
  const inserted = await supabaseInsert(allRecords);

  console.log('\n📊 최종 결과:');
  console.log('─'.repeat(40));
  for (const [name, d] of Object.entries(summary)) {
    console.log(`  ${name} (${POLITICIANS[name]}): ${d.status} | 프로필 ${d.profile}, 법안 ${d.bills}`);
  }
  console.log(`  본회의 표결: ${voteRows.length}건`);
  console.log(`  ✅ 총 적재: ${inserted}건`);
}

main().catch(console.error);
