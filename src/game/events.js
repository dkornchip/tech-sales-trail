import { killDeals, makeDeal } from "./deals.js";
import { log } from "./log.js";
import { clamp, money, randi } from "./util.js";

export const randomEvents=(state,setPending,maxFires=2)=>{
  let s={...state};
  let firedCount=0;
  let modalQueued=false;
  const fire=(prob,fn,{modal=false}={})=>{
    if(firedCount>=maxFires)return;
    if(modal && modalQueued)return;
    if(Math.random()<prob){
      s=fn(s);
      firedCount++;
      if(modal)modalQueued=true;
    }
  };

  fire(0.22,st=>{
    const n=randi(2,6);
    const adds=Array.from({length:n},()=>makeDeal(st,{warm:true}));
    st.deals=[...adds,...st.deals];
    st.pipeline=st.deals.reduce((sum,d)=>sum+d.value,0);
    return log(st,`📣 Marketing delivered ${n} “warm” leads.`);
  });

  fire(0.18,st=>{
    setPending({
      title:"🧨 Competitor Panic",
      body:"They cut 25%. Match 20% or hold?",
      options:[
        {
          label:"Match 20% (more wins, less $)",
          className:"primary",
          action:(x)=>{
            const baseConv = x.modifiers?.conversion ?? 0;
            x.modifiers={
              conversion:clamp(baseConv+0.12,-0.30,0.30),
              discount:0.20,
              expiresIn:1
            };
            return log(x,"💸 Matched 20%. Wins up, ACV down this week.");
          }
        },
        {
          label:"Hold price (fewer wins, +rep)",
          className:"ghost",
          action:(x)=>{
            const baseConv = x.modifiers?.conversion ?? 0;
            x.reputation=clamp(x.reputation+4,0,100);
            x.modifiers={
              conversion:clamp(baseConv-0.08,-0.30,0.30),
              discount:0,
              expiresIn:1
            };
            return log(x,"🧱 Held price. Fewer closes this week, +rep.","warn");
          }
        }
      ]
    });
    return st;
  },{modal:true});

  fire(0.14,st=>{
    const candidate=st.deals.find(d=>d.stage===1||d.stage===2);
    if(!candidate)return st;
    st.product=clamp(st.product-6,0,100);
    st.stress=clamp(st.stress+4,0,100);
    return log(st,`🛠️ SE fumbled ${candidate.account}. -6 product, +4 stress.`,"warn");
  });

  fire(0.12,st=>{
    const candidate=st.deals.find(d=>d.stage>=2);
    if(!candidate)return st;
    st.product=clamp(st.product+8,0,100);
    st.reputation=clamp(st.reputation+3,0,100);
    return log(st,`🧙 SE saved ${candidate.account}. +8 product, +3 rep.`);
  });

  fire(0.10,st=>{
    setPending({
      title:"🔐 Security Incident",
      body:"A customer got breached. Own it or spin it?",
      options:[
        {
          label:"Own it (+rep, fewer wins)",
          className:"primary",
          action:(x)=>{
            x.reputation=clamp(x.reputation+6,0,100);
            x.product=clamp(x.product-18,0,100);
            x.modifiers={conversion:-0.15,discount:0,expiresIn:2};
            x=killDeals(x,d=>d.stage>=2,0.30);
            return log(x,"🔦 Came clean. +rep, closes tank for a bit.","warn");
          }
        },
        {
          label:"Spin it (safer pipe, -\u2060rep)", // word joiner: keeps "-rep" on one line
          className:"ghost",
          action:(x)=>{
            x.reputation=clamp(x.reputation-8,0,100);
            x.product=clamp(x.product-12,0,100);
            x.modifiers={conversion:-0.08,discount:0,expiresIn:1};
            x=killDeals(x,d=>d.stage>=2,0.15);
            return log(x,"🌀 Spun it. Pipe mostly safe, rep takes a hit.","warn");
          }
        }
      ]
    });
    return st;
  },{modal:true});

  fire(0.12,st=>{
    st.product=clamp(st.product-12,0,100);
    st=killDeals(st,d=>d.stage>=2,0.18);
    return log(st,"🌩️ Cloud outage ate the demos. -12 product.","bad");
  });

  fire(0.11,st=>{
    const candidate=st.deals.find(d=>d.stage>=2);
    if(!candidate)return st;
    const boosted={...candidate,stage:Math.min(4,candidate.stage+1),mood:"happy"};
    st.deals=st.deals.map(d=>d.id===candidate.id?boosted:d);
    st.pipeline=st.deals.reduce((sum,d)=>sum+d.value,0);
    st.reputation=clamp(st.reputation+3,0,100);
    st.manager=clamp(st.manager+3,0,100);
    return log(st,`🪜 Champion promoted at ${candidate.account}. Deal moves up.`);
  });

  fire(0.10,st=>{
    st.reputation=clamp(st.reputation+5,0,100);
    st.modifiers={
      conversion:(st.modifiers.conversion||0)+0.08,
      discount:st.modifiers.discount||0,
      expiresIn:Math.max(1,st.modifiers.expiresIn||0)
    };
    return log(st,"📘 Case study live. +rep, +8% close for now.");
  });

  fire(0.10,st=>{
    const n=randi(1,3);
    const adds=Array.from({length:n},()=>makeDeal(st,{warm:true,big:Math.random()<0.5}));
    st.deals=[...adds,...st.deals];
    st.pipeline=st.deals.reduce((sum,d)=>sum+d.value,0);
    st.reputation=clamp(st.reputation+4,0,100);
    return log(st,`🐦 Product became a meme. +${n} inbound lead(s).`);
  });

  fire(0.10,st=>{
    st.modifiers={
      conversion:(st.modifiers.conversion||0)-0.12,
      discount:st.modifiers.discount||0,
      expiresIn:Math.max(1,st.modifiers.expiresIn||0)
    };
    return log(st,"🥶 Budget freeze rumor. Closes nerfed this week.","warn");
  });

  fire(0.10,st=>{
    if(st.energy<55){
      st.stress=clamp(st.stress+6,0,100);
      st.energy=clamp(st.energy-10,0,100);
      return log(st,"🤒 Conference crud. -10 energy, +6 stress.","warn");
    }
    return st;
  });

  fire(0.11,st=>{
    if(st.manager>=35 || st.deals.length===0)return st;
    const sorted=[...st.deals].sort((a,b)=>b.value-a.value);
    const toSteal=sorted.slice(0,Math.min(2,sorted.length));
    const stealIds=new Set(toSteal.map(d=>d.id));
    let total=0;
    st.deals=st.deals.filter(d=>{
      if(stealIds.has(d.id)){total+=d.value;return false;}
      return true;
    });
    st.pipeline=st.deals.reduce((sum,d)=>sum+d.value,0);
    st=log(st,`📉 Territory “rebalance.” Lost ${toSteal.length} top deal(s), ${money(total)}.`,"bad");
    return st;
  });

  fire(0.09,st=>{
    if(st.manager<75)return st;
    if(st.pip && Math.random()<0.6){
      st.pip=false;
      st.pipLevel=0;
      return log(st,"🛡️ Manager shredded your PIP. “Fresh start.”");
    }
    const n=randi(1,3);
    const adds=Array.from({length:n},()=>makeDeal(st,{warm:true,big:Math.random()<0.5}));
    st.deals=[...adds,...st.deals];
    st.pipeline=st.deals.reduce((sum,d)=>sum+d.value,0);
    return log(st,`🛡️ Manager called in favors. +${n} warm intro(s).`);
  });

  return s;
};
