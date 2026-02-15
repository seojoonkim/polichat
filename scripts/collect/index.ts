#!/usr/bin/env npx tsx
/**
 * 셀럽 데이터 수집 통합 실행 스크립트
 * 
 * 사용법:
 *   npx tsx scripts/collect/index.ts --idol=wonyoung
 *   npx tsx scripts/collect/index.ts --all
 *   npx tsx scripts/collect/index.ts --idol=wonyoung --source=namuwiki
 *   npx tsx scripts/collect/index.ts --process  # 수집된 데이터 처리만
 */

import { getIdol, getAllIdols } from './config.js';
import { collectNamuwiki } from './namuwiki.js';
import { collectNews } from './news.js';
import { collectDcinside } from './dcinside.js';
import { collectWikipedia } from './wikipedia.js';
import { collectYoutube } from './youtube.js';
import { processCollectedData } from './processor.js';
import type { IdolConfig, CollectedData, CollectorOptions } from './types.js';

type SourceType = 'namuwiki' | 'news' | 'dcinside' | 'wikipedia' | 'youtube' | 'all';

interface CliArgs {
  idol?: string;
  all?: boolean;
  source?: SourceType;
  process?: boolean;
  help?: boolean;
}

const COLLECTORS = {
  namuwiki: collectNamuwiki,
  news: collectNews,
  dcinside: collectDcinside,
  wikipedia: collectWikipedia,
  youtube: collectYoutube,
};

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  
  for (const arg of process.argv.slice(2)) {
    if (arg === '--all') args.all = true;
    else if (arg === '--process') args.process = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg.startsWith('--idol=')) args.idol = arg.split('=')[1];
    else if (arg.startsWith('--source=')) args.source = arg.split('=')[1] as SourceType;
  }
  
  return args;
}

function printHelp(): void {
  console.log(`
📦 Mim.chat 셀럽 데이터 수집기

사용법:
  npx tsx scripts/collect/index.ts [옵션]

옵션:
  --idol=<id>      특정 아이돌 수집 (wonyoung, mingyu, chaeyeon, rain)
  --all            모든 아이돌 수집
  --source=<type>  특정 소스만 (namuwiki, news, dcinside, wikipedia, youtube)
  --process        수집된 데이터 처리 (청킹)
  --help, -h       도움말

예시:
  npx tsx scripts/collect/index.ts --idol=wonyoung
  npx tsx scripts/collect/index.ts --all --source=wikipedia
  npx tsx scripts/collect/index.ts --process
`);
}

async function collectForIdol(
  idol: IdolConfig,
  source: SourceType = 'all',
  options: CollectorOptions = {}
): Promise<CollectedData[]> {
  const results: CollectedData[] = [];
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🎤 수집 시작: ${idol.name} (${idol.id})`);
  console.log(`${'='.repeat(50)}\n`);
  
  const sources = source === 'all' 
    ? Object.keys(COLLECTORS) as (keyof typeof COLLECTORS)[]
    : [source];
  
  for (const src of sources) {
    if (COLLECTORS[src]) {
      try {
        console.log(`\n📥 [${src}] 수집 중...`);
        const data = await COLLECTORS[src](idol, options);
        results.push(...data);
      } catch (error) {
        console.error(`❌ [${src}] 에러:`, error);
      }
    }
  }
  
  return results;
}

async function main(): Promise<void> {
  const args = parseArgs();
  
  if (args.help) {
    printHelp();
    return;
  }
  
  console.log(`
╔══════════════════════════════════════════════════╗
║      🎵 Mim.chat 셀럽 데이터 수집기 v1.0        ║
╚══════════════════════════════════════════════════╝
`);
  
  // 처리만 실행
  if (args.process) {
    console.log('📊 데이터 처리 시작...\n');
    await processCollectedData();
    console.log('\n✅ 처리 완료!');
    return;
  }
  
  // 수집 대상 결정
  let idols: IdolConfig[] = [];
  
  if (args.all) {
    idols = getAllIdols();
    console.log(`📋 전체 아이돌 수집 (${idols.length}명)`);
  } else if (args.idol) {
    const idol = getIdol(args.idol);
    if (!idol) {
      console.error(`❌ 아이돌을 찾을 수 없음: ${args.idol}`);
      console.log('사용 가능: wonyoung, mingyu, chaeyeon, rain');
      process.exit(1);
    }
    idols = [idol];
  } else {
    printHelp();
    return;
  }
  
  const source = args.source || 'all';
  console.log(`🔍 소스: ${source}`);
  
  const startTime = Date.now();
  let totalCollected = 0;
  
  for (const idol of idols) {
    const data = await collectForIdol(idol, source);
    totalCollected += data.length;
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(`
╔══════════════════════════════════════════════════╗
║                    📊 수집 완료                   ║
╠══════════════════════════════════════════════════╣
║  아이돌: ${idols.length}명
║  총 데이터: ${totalCollected}개
║  소요 시간: ${elapsed}초
╚══════════════════════════════════════════════════╝

💡 다음 단계:
   npx tsx scripts/collect/index.ts --process
`);
}

main().catch(console.error);
