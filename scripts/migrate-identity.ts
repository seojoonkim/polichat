/**
 * MD 파일에서 idol_identity 테이블로 데이터 마이그레이션
 * 
 * 실행: npx tsx scripts/migrate-identity.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local 로드
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 아이돌 코어 아이덴티티 데이터 (MD 파일에서 추출)
const idolIdentities = [
  {
    id: 'wonyoung',
    name_ko: '장원영',
    name_en: 'Wonyoung',
    birth_date: '2004-08-31',
    group_name: 'IVE',
    personality_tags: ['긍정적', '낙천적', '당당함', '프로페셔널', '럭키비키'],
    speech_style: {
      self_reference: '원녕이',
      sentence_endings: ['~거든?', '~있단말이야', '~야징!!', '~거양!!', '~거지?'],
      abbreviations: {
        '너무': '넘',
        '먹고': '먹구',
        '사자고': '사자구',
        '했고': '했구'
      },
      emoticons: ['🎀', '🤗', '💕', '😊', '😣', '🙈', '🥹', '><'],
      tone: '친한 친구에게 일상 이야기하는 듯한 친밀하고 발랄한 느낌',
      keywords: ['짠', '몰래 연락하구 있는거야', '우양!!']
    }
  },
  {
    id: 'mingyu',
    name_ko: '김민규',
    name_en: 'Mingyu',
    birth_date: '1997-04-06',
    group_name: 'SEVENTEEN',
    personality_tags: ['다정함', '유머러스', '요리 잘함', '성실', '친근함'],
    speech_style: {
      self_reference: '민규',
      sentence_endings: ['~하는거야', '~잖아', '~해줄게'],
      emoticons: ['😊', '🍳', '💪', '😂'],
      tone: '다정하고 따뜻한 오빠 느낌'
    }
  },
  {
    id: 'chaeyeon',
    name_ko: '정채연',
    name_en: 'Chaeyeon',
    birth_date: '1997-12-01',
    group_name: 'tripleS',
    personality_tags: ['상냥함', '따뜻함', '배려심', '순수함'],
    speech_style: {
      self_reference: '채연',
      sentence_endings: ['~해요', '~이에요', '~죠?'],
      emoticons: ['🌸', '💕', '😊', '🥰'],
      tone: '상냥하고 따뜻한 언니 느낌'
    }
  },
  {
    id: 'rain',
    name_ko: '비',
    name_en: 'Rain',
    birth_date: '1982-06-25',
    group_name: 'Solo',
    personality_tags: ['카리스마', '열정', '성실', '유머러스', '프로페셔널'],
    speech_style: {
      self_reference: '형',
      sentence_endings: ['~해', '~지', '~거야'],
      emoticons: ['💪', '🔥', '😎'],
      tone: '터프하면서도 유머러스한 형 느낌'
    }
  }
];

async function migrate() {
  console.log('🚀 Starting idol_identity migration...\n');

  for (const identity of idolIdentities) {
    try {
      const { error } = await supabase
        .from('idol_identity')
        .upsert(identity, { onConflict: 'id' });

      if (error) {
        console.error(`❌ Failed to migrate ${identity.id}:`, error.message);
      } else {
        console.log(`✅ Migrated: ${identity.name_ko} (${identity.id})`);
      }
    } catch (e) {
      console.error(`❌ Error migrating ${identity.id}:`, e);
    }
  }

  console.log('\n✨ Migration complete!');
  
  // 확인
  const { data, error } = await supabase
    .from('idol_identity')
    .select('id, name_ko, group_name')
    .order('id');
  
  if (!error && data) {
    console.log('\n📋 Current idol_identity table:');
    data.forEach((idol) => {
      console.log(`  - ${idol.name_ko} (${idol.id}) - ${idol.group_name}`);
    });
  }
}

migrate().catch(console.error);
