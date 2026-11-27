import assert from 'node:assert/strict';
import test from 'node:test';
import {designLink,readDesign} from '../js/vysledok.js';

const page='https://example.test/studio/index.html?k=vzor';
const key='A'.repeat(43);
const state={
  type:'dvojhrob',shape:'slza',cover:'delena',stone:'impala',environment:'rano',
  font:'cinzel',finish:'zlata',customFinish:true,
  people:[{first:'Ľubica',last:'Šťastná'},{first:'Štefan',last:'Černý',birth:'1942'}],
  extras:['lampas'],epitaph:'Spomíname\ns láskou',nameAt:'face',verseAt:'slab'
};

for(const reverse of [false,true]){
  test('Súkromný návrh, prvý parameter '+(reverse?'ukazka':'navrh'),()=>{
    globalThis.location=new URL(page+'#ukazka='+key);
    const shared=new URL(designLink(state));
    const entries=[...new URLSearchParams(shared.hash.slice(1))];
    if(reverse)entries.reverse();
    shared.hash=new URLSearchParams(entries).toString();
    globalThis.location=shared;
    assert.deepEqual(readDesign(),state);
    assert.equal(new URLSearchParams(new URL(designLink(readDesign())).hash.slice(1)).get('ukazka'),key);
    assert.equal(shared.search,'?k=vzor');
  });
}

test('Starší formát so štandardným Base64 a doslovným plusom',()=>{
  const old={v:1,epitaph:'aa>~~~',shape:'kniha'};
  const payload=Buffer.from(JSON.stringify(old)).toString('base64');
  assert.ok(payload.includes('+'));
  globalThis.location=new URL(page+'#navrh='+payload);
  assert.deepEqual(readDesign(),old);
});

test('Samotný kľúč alebo nečitateľný návrh otvorí úvod',()=>{
  for(const hash of ['ukazka='+key,'navrh=','navrh=%','navrh='+('A'.repeat(200001))]){
    globalThis.location=new URL(page+'#'+hash);
    assert.equal(readDesign(),null);
  }
});
