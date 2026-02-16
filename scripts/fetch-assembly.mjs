#!/usr/bin/env node
// 국회 오픈API → Supabase 적재 스크립트
// 대상: 이재명, 정청래, 장동혁 (+ 오세훈/정원오는 국회의원 아닐 수 있음)

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
  url.searchParams.set('pIndex', '1');
  url.searchParams.set('pSize', '300');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await res.json();
  
  // API returns { apiCode: [{ head }, { row }] } or { RESULT: { CODE, MESSAGE } }
  if (data.RESULT) {
    console.log(`  ⚠️ API ${apiCode}: ${data.RESULT.MESSAGE}`);
    return [];
  }
  const wrapper = data[apiCode];
  if (!wrapper || !wrapper[1] || !wrapper[1].row) return [];
  return wrapper[1].row;
}

async function supabaseInsert(records) {
  if (records.length === 0) return;
  
  // Batch insert (max 100 at a time)
  for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/politician_speeches`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`  ❌ Supabase error: ${res.status} ${err}`);
    }
  }
}

async function main() {
  const results = {};
  
  // 1. 국회의원 인적사항 (프로필)
  console.log('📋 1. 국회의원 인적사항 수집...');
  const profiles = await apiFetch('nwvrqwxyaytdsfvhu');
  const profileRecords = [];
  
  for (const row of profiles) {
    const name = row.HG_NM;
    if (!(name in POLITICIANS)) continue;
    const pid = POLITICIANS[name];
    results[name] = results[name] || { profile: 0, bills: 0, votes: 0 };
    results[name].profile = 1;
    
    profileRecords.push({
      politician_id: pid,
      source: 'assembly_profile',
      content: `${name} (${row.POLY_NM}, ${row.ORIG_NM}) - ${row.REELE_GBN_NM}\n위원회: ${row.CMIT_NM}\n연락처: ${row.TEL_NO}\n이메일: ${row.E_MAIL}\n\n경력:\n${row.MEM_TITLE || ''}`,
      metadata: {
        api: 'nwvrqwxyaytdsfvhu',
        party: row.POLY_NM,
        district: row.ORIG_NM,
        committee: row.CMIT_NM,
        reelection: row.REELE_GBN_NM,
        mona_cd: row.MONA_CD,
      },
    });
  }
  
  console.log(`  Found profiles: ${profileRecords.map(r => r.metadata.party + ' ' + r.content.split(' ')[0]).join(', ') || 'none'}`);
  
  // Check who's missing (not a current member)
  for (const name of Object.keys(POLITICIANS)) {
    if (!results[name]) {
      console.log(`  ⚠️ ${name}: 현재 국회의원 목록에 없음 (스킵)`);
    }
  }
  
  await supabaseInsert(profileRecords);
  console.log(`  ✅ ${profileRecords.length}건 적재`);
  
  // 2. 발의법률안 (22대)
  console.log('\n📋 2. 발의법률안 수집...');
  const billRecords = [];
  
  // Fetch all pages
  for (let page = 1; page <= 160; page++) { // 15394 / 100 ≈ 154 pages
    const url = new URL(`${BASE}/nzmimeepazxkubdpn`);
    url.searchParams.set('Type', 'json');
    url.searchParams.set('pIndex', String(page));
    url.searchParams.set('pSize', '100');
    url.searchParams.set('AGE', '22');
    
    const res = await fetch(url.toString(), { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const wrapper = data.nzmimeepazxkubdpn;
    if (!wrapper || !wrapper[1] || !wrapper[1].row) break;
    const rows = wrapper[1].row;
    
    for (const row of rows) {
      // Check PROPOSER or RST_PROPOSER for our politicians
      for (const [name, pid] of Object.entries(POLITICIANS)) {
        if (!results[name]) continue; // skip non-members
        const proposer = row.PROPOSER || '';
        const rstProposer = row.RST_PROPOSER || '';
        const publProposer = row.PUBL_PROPOSER || '';
        
        if (rstProposer === name || proposer.includes(name) || publProposer.includes(name)) {
          results[name] = results[name] || { profile: 0, bills: 0, votes: 0 };
          results[name].bills++;
          const isMain = rstProposer === name;
          
          billRecords.push({
            politician_id: pid,
            source: 'assembly_bills',
            content: `[${isMain ? '대표발의' : '공동발의'}] ${row.BILL_NAME} (${row.BILL_NO})\n발의일: ${row.PROPOSE_DT}\n대표발의자: ${row.RST_PROPOSER}\n처리결과: ${row.PROC_RESULT || '계류중'}`,
            metadata: {
              api: 'nzmimeepazxkubdpn',
              bill_id: row.BILL_ID,
              bill_no: row.BILL_NO,
              bill_name: row.BILL_NAME,
              propose_dt: row.PROPOSE_DT,
              is_main_proposer: isMain,
              proc_result: row.PROC_RESULT,
            },
          });
        }
      }
    }
    
    if (rows.length < 100) break;
    if (page % 20 === 0) {
      console.log(`  ... page ${page} scanned, ${billRecords.length} bills found so far`);
      await sleep(200);
    }
  }
  
  for (const [name, data] of Object.entries(results)) {
    if (data.bills > 0) console.log(`  ${name}: ${data.bills}건`);
  }
  
  await supabaseInsert(billRecords);
  console.log(`  ✅ ${billRecords.length}건 적재`);
  
  // 3. 본회의 표결정보 (nwbpacrgavhjryiph - bill-level votes)
  console.log('\n📋 3. 본회의 표결정보 수집...');
  const voteRows = await apiFetch('nwbpacrgavhjryiph', { AGE: '22' });
  const voteRecords = [];
  
  // This API shows bill-level vote totals, not per-member
  // Store as general vote context for each politician who's a member
  for (const [name, pid] of Object.entries(POLITICIANS)) {
    if (!results[name]) continue;
  }
  
  // Try to get per-member vote records with a different approach
  // The individual vote API might need BILL_ID + member lookup
  console.log(`  ℹ️ 본회의 표결 API: ${voteRows.length}건 (법안 단위, 개인 투표 기록은 별도 API 필요)`);
  
  // Store recent vote summaries as context
  for (const row of voteRows.slice(0, 50)) {
    // Store as general assembly context for all members
    for (const [name, pid] of Object.entries(POLITICIANS)) {
      if (!results[name]) continue;
      results[name].votes = (results[name].votes || 0);
    }
    
    voteRecords.push({
      politician_id: 'assembly_general',
      source: 'assembly_votes',
      content: `[본회의 표결] ${row.BILL_NM}\n발의자: ${row.PROPOSER}\n위원회: ${row.COMMITTEE_NM}\n결과: ${row.PROC_RESULT_CD}\n총투표: ${row.VOTE_TCNT}명, 찬성: ${row.YES_TCNT}, 반대: ${row.NO_TCNT || 0}, 기권: ${row.BLANK_TCNT || 0}\n처리일: ${row.LAW_PROC_DT}`,
      metadata: {
        api: 'nwbpacrgavhjryiph',
        bill_no: row.BILL_NO,
        bill_id: row.BILL_ID,
        proc_result: row.PROC_RESULT_CD,
        vote_total: row.VOTE_TCNT,
        yes: row.YES_TCNT,
        no: row.NO_TCNT,
        blank: row.BLANK_TCNT,
      },
    });
  }
  
  await supabaseInsert(voteRecords);
  console.log(`  ✅ ${voteRecords.length}건 적재`);
  
  // Summary
  console.log('\n📊 최종 결과:');
  console.log('─'.repeat(40));
  for (const [name, data] of Object.entries(results)) {
    console.log(`  ${name} (${POLITICIANS[name]}): 프로필 ${data.profile}건, 법안 ${data.bills}건`);
  }
  console.log(`  본회의 표결: ${voteRecords.length}건 (전체)`);
  console.log(`  총 적재: ${profileRecords.length + billRecords.length + voteRecords.length}건`);
}

main().catch(console.error);
