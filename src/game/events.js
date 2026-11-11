import { killDeals, makeDeal, withDeals } from "./deals.js";
import { log } from "./log.js";
import { clamp, randi } from "./util.js";

// The events that stop the game and wait for an answer, as data. An open dialog is just {id, params}: the id names an
// entry here (what each button does) and one in src/copy/events.js (what the dialog says). Each option's apply()
// takes the state when the button is pressed and returns the next one; it never changes the state it was given.
// The ids are the dialog ids the test harness and the sound director know: "evt:" for the two End Week choices,
// "ck:" for clAInk's manager (see clainkManager in claink.js), which only asks to be acknowledged.
export const EVENTS={
  "evt:competitor":{options:[
    {
      id:"match",
      className:"primary",
      apply:(state)=>{
        const x={...state};
        const baseConv = x.modifiers?.conversion ?? 0;
        x.modifiers={
          conversion:clamp(baseConv+0.12,-0.30,0.30),
          discount:0.20,
          expiresIn:1
        };
        return log(x,"evt.competitor.match");
      }
    },
    {
      id:"hold",
      className:"ghost",
      apply:(state)=>{
        const x={...state};
        const baseConv = x.modifiers?.conversion ?? 0;
        x.reputation=clamp(x.reputation+4,0,100);
        x.modifiers={
          conversion:clamp(baseConv-0.08,-0.30,0.30),
          discount:0,
          expiresIn:1
        };
        return log(x,"evt.competitor.hold",null,"warn");
      }
    }
  ]},
  "evt:security":{options:[
    {
      id:"own",
      className:"primary",
      apply:(state)=>{
        let x={...state};
        x.reputation=clamp(x.reputation+6,0,100);
        x.product=clamp(x.product-18,0,100);
        x.modifiers={conversion:-0.15,discount:0,expiresIn:2};
        x=killDeals(x,d=>d.stage>=2,0.30);
        return log(x,"evt.security.own",null,"warn");
      }
    },
    {
      id:"spin",
      className:"ghost",
      apply:(state)=>{
        let x={...state};
        x.reputation=clamp(x.reputation-8,0,100);
        x.product=clamp(x.product-12,0,100);
        x.modifiers={conversion:-0.08,discount:0,expiresIn:1};
        x=killDeals(x,d=>d.stage>=2,0.15);
        return log(x,"evt.security.spin",null,"warn");
      }
    }
  ]},
  "ck:warning":{options:[{id:"ack",className:"primary",apply:(state)=>({...state})}]},
  "ck:lesson":{options:[{id:"ack",className:"primary",apply:(state)=>({...state})}]}
};

// queueEvent({id, params}) is called for an event that needs a choice, at the moment it fires.
export const randomEvents=(state,queueEvent,maxFires=2)=>{
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
    st.deals=withDeals(st.deals,adds);
    st.pipeline=st.deals.reduce((sum,d)=>sum+d.value,0);
    return log(st,"evt.marketing",{n});
  });

  fire(0.18,st=>{
    queueEvent({id:"evt:competitor"});
    return st;
  },{modal:true});

  fire(0.14,st=>{
    const candidate=st.deals.find(d=>d.stage===1||d.stage===2);
    if(!candidate)return st;
    st.product=clamp(st.product-6,0,100);
    st.stress=clamp(st.stress+4,0,100);
    return log(st,"evt.seFumble",{account:candidate.account},"warn");
  });

  fire(0.12,st=>{
    const candidate=st.deals.find(d=>d.stage>=2);
    if(!candidate)return st;
    st.product=clamp(st.product+8,0,100);
    st.reputation=clamp(st.reputation+3,0,100);
    return log(st,"evt.seSave",{account:candidate.account});
  });

  fire(0.10,st=>{
    queueEvent({id:"evt:security"});
    return st;
  },{modal:true});

  fire(0.12,st=>{
    st.product=clamp(st.product-12,0,100);
    st=killDeals(st,d=>d.stage>=2,0.18);
    return log(st,"evt.outage",null,"bad");
  });

  fire(0.11,st=>{
    const candidate=st.deals.find(d=>d.stage>=2);
    if(!candidate)return st;
    const boosted={...candidate,stage:Math.min(4,candidate.stage+1),mood:"happy"};
    st.deals=st.deals.map(d=>d.id===candidate.id?boosted:d);
    st.pipeline=st.deals.reduce((sum,d)=>sum+d.value,0);
    st.reputation=clamp(st.reputation+3,0,100);
    st.manager=clamp(st.manager+3,0,100);
    return log(st,"evt.champion",{account:candidate.account});
  });

  fire(0.10,st=>{
    st.reputation=clamp(st.reputation+5,0,100);
    st.modifiers={
      conversion:(st.modifiers.conversion||0)+0.08,
      discount:st.modifiers.discount||0,
      expiresIn:Math.max(1,st.modifiers.expiresIn||0)
    };
    return log(st,"evt.caseStudy");
  });

  fire(0.10,st=>{
    const n=randi(1,3);
    const adds=Array.from({length:n},()=>makeDeal(st,{warm:true,big:Math.random()<0.5}));
    st.deals=withDeals(st.deals,adds);
    st.pipeline=st.deals.reduce((sum,d)=>sum+d.value,0);
    st.reputation=clamp(st.reputation+4,0,100);
    return log(st,"evt.meme",{n});
  });

  fire(0.10,st=>{
    st.modifiers={
      conversion:(st.modifiers.conversion||0)-0.12,
      discount:st.modifiers.discount||0,
      expiresIn:Math.max(1,st.modifiers.expiresIn||0)
    };
    return log(st,"evt.freeze",null,"warn");
  });

  fire(0.10,st=>{
    if(st.energy<55){
      st.stress=clamp(st.stress+6,0,100);
      st.energy=clamp(st.energy-10,0,100);
      return log(st,"evt.crud",null,"warn");
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
    st=log(st,"evt.rebalance",{n:toSteal.length,value:total},"bad");
    return st;
  });

  fire(0.09,st=>{
    if(st.manager<75)return st;
    if(st.pip && Math.random()<0.6){
      st.pip=false;
      st.pipLevel=0;
      return log(st,"evt.pipShred");
    }
    const n=randi(1,3);
    const adds=Array.from({length:n},()=>makeDeal(st,{warm:true,big:Math.random()<0.5}));
    st.deals=withDeals(st.deals,adds);
    st.pipeline=st.deals.reduce((sum,d)=>sum+d.value,0);
    return log(st,"evt.favors",{n});
  });

  return s;
};
