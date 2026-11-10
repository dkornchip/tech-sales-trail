import React from "react";
import ReactDOM from "react-dom/client";
    const { useState, useEffect, useRef } = React;

    const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    // v1.14: sound + toast hooks. Everything below is presentation only; game state never reads from these.
    const AUDIO=()=>window.TST_AUDIO||null;
    const sfx=(name,opts)=>{ const a=AUDIO(); if(a) a.play(name,opts); };
    const notify=(msg)=>{ if(window.TST_TOAST) window.TST_TOAST(msg); else alert(msg); };

    const QUARTER_WEEKS = 13;
    const MAX_QUARTERS = 1;

    // Save keys unchanged so existing runs keep loading; legacy keys still read.
    const SAVE_KEY = "tst-save-v4-3";
    const AUTOSAVE_KEY = "tst-autosave-v4-3";
    const LEGACY_KEYS = ["tst-save-v4-2", "tst-autosave-v4-2"];

    const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
    const rand=(a,b)=>Math.random()*(b-a)+a;
    const randi=(a,b)=>Math.floor(rand(a,b+1));
    const choice=(arr)=>arr[Math.floor(Math.random()*arr.length)];
    // FIX: negative cash used to render as "$-1,500". en-US grouping everywhere: logs, badges and the big-close PA regex.
    const money=(n)=>{const r=Math.round(n);return (r<0?"-$":"$")+Math.abs(r).toLocaleString("en-US");};
    const pct=(p)=>Math.round(p*100);
    const now=()=>new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
    const idGen=(()=>{let i=0;return()=> (++i).toString(36)+"-"+Date.now().toString(36).slice(-4)})();

    const STAGE_NAMES=["Lead","Qualified","Demoed","Proposal","Closing"];
    const MOODS=["skeptical","neutral","curious","happy"];

    const ACCOUNT_NAMES=[
      "Acme Quantum","NebulaSoft","Feral Unicorn","DataRamen","ByteBazaar","Nimbus Forge",
      "YakStack","HyperLobster","Pinecone Pizza","Mojo Metrics","Slothly AI","Cobalt Circus",
      "Orbit Orchard","Cosmic Bagel","Spicy API","Tesseract Tea","GigaGarden","Marmot Systems",
      "Cronut Cloud","Obsidian Harbor","Parallax Donuts","Velvet Glacier","Ghost Pepper Labs",
      "Mythic Compass","Obelisk Systems","Carbon Jellyfish","Mirrorwave Media","Static Llama",
      "Caffeine Cathedral","Infinite Wasabi","Aurora Churros","Neon Narwhal","Quasar Laundry",
      "Monolith Karaoke","Origami Fortress","Ruby Iguana","Saffron Nebula","Lottery Lagoon",
      "Circuit Sashimi","Helix Orchard","Glacier Lantern","Paper Tiger Rail","Mosaic Marmot",
      "Golem Bistro","Vespertine Motel","Polaris Tacos","Kintsugi Metrics","Chimera Hardware",
      "Murmur Harbor","Lantern Algebra","Cryptic Custard","Midnight Otter","Velvet Switchboard",
      "Oracle Dumpling","Oblique Wombat","Cerulean Vineyard","Signal Pagoda"
    ];

    const getQuarterInfo=(week)=>{
      const quarter=Math.floor((week-1)/QUARTER_WEEKS)+1;
      const weekInQuarter=((week-1)%QUARTER_WEEKS)+1;
      return{quarter,weekInQuarter};
    };

    // FIX: page refresh now resumes the autosave (most recent state); the Load button prefers the manual save.
    const readStoredRun=(preferAutosave=true)=>{
      const keys=preferAutosave
        ?[AUTOSAVE_KEY, SAVE_KEY, ...LEGACY_KEYS]
        :[SAVE_KEY, AUTOSAVE_KEY, ...LEGACY_KEYS];
      for(const k of keys){
        try{
          const v=localStorage.getItem(k);
          if(v) return v;
        }catch{}
      }
      return null;
    };

    // Single merge path for restored runs (was duplicated between initial load and the Load button).
    const mergeSaved=(parsed)=>{
      const base=newGame();
      return{
        ...base,
        ...parsed,
        quota: base.quota, // force current difficulty
        skills:{...base.skills,...(parsed.skills||{})},
        modifiers:{...base.modifiers,...(parsed.modifiers||{})},
        used:{...base.used,...(parsed.used||{})},
        repo:!!parsed.repo,
        repoWarned:!!parsed.repoWarned,
        perfWarnings:Number.isFinite(parsed.perfWarnings)?parsed.perfWarnings:0,
        // v1.15 fields; v1.14 saves don't have them
        coffeesThisWeek:Number.isFinite(parsed.coffeesThisWeek)?Math.max(0,Math.floor(parsed.coffeesThisWeek)):0,
        stressWarned:!!parsed.stressWarned,
        trip:typeof parsed.trip==="string"?parsed.trip:null,
        hygieneShield:!!parsed.hygieneShield,
        claink:sanitizeClaink(parsed.claink,parsed.week), // v1.19; also maps the v1.16 prototype's save shape
        endCause:typeof parsed.endCause==="string"?parsed.endCause:null
      };
    };

    // Clone nested sub-objects that actions mutate, to avoid accidental state mutation bugs.
    const cloneForSpend=(state)=>({
      ...state,
      skills:{...(state.skills||{})},
      modifiers:{...(state.modifiers||{})},
      used:{...(state.used||{})}
    });

    const tickModifiers=(state)=>{
      let s={...state, modifiers:{...(state.modifiers||{conversion:0,discount:0,expiresIn:0})}};
      if((s.modifiers.expiresIn||0)>0){
        s.modifiers.expiresIn-=1;
        if(s.modifiers.expiresIn<=0){
          s.modifiers={conversion:0,discount:0,expiresIn:0};
        }
      }
      return s;
    };

    // Eases a displayed number toward its real value; the real value is never changed.
    const useTween=(target,ms=650)=>{
      const[v,setV]=useState(target);
      const rafRef=useRef(0);
      useEffect(()=>{
        if(REDUCED_MOTION){setV(target);return;}
        const from=v;
        if(from===target)return;
        const start=performance.now();
        cancelAnimationFrame(rafRef.current);
        const step=(t)=>{
          const p=Math.min(1,(t-start)/ms);
          const e=1-Math.pow(1-p,3);
          if(p<1){
            setV(from+(target-from)*e);
            rafRef.current=requestAnimationFrame(step);
          }else{
            setV(target);
          }
        };
        rafRef.current=requestAnimationFrame(step);
        return()=>cancelAnimationFrame(rafRef.current);
      },[target]);
      return v;
    };

    const Stat=({label,value,num,fmt,sub,barValue,barKind})=>{
      const hasNum=typeof num==="number";
      const tv=useTween(hasNum?num:0);
      const display=hasNum ? (fmt?fmt(tv):String(Math.round(tv))) : value;
      let cls="bar";
      if(barKind)cls+=" "+barKind;
      return(
        <div className="stat">
          <div className="label">{label}</div>
          <div className="value pop" key={hasNum?num:value}>{display}</div>
          {sub && <div className="sub">{sub}</div>}
          {typeof barValue==="number" && (
            <div className={cls}>
              <div style={{width:clamp(barValue,0,100)+"%"}}/>
            </div>
          )}
        </div>
      );
    };

    const DealCard=({deal})=>{
      const stageName=STAGE_NAMES[deal.stage]||"Unknown";
      const moodClass="pill mood-"+deal.mood;
      return(
        <div className="deal">
          <div className="deal-header">
            <div className="deal-title">{deal.account}</div>
            <div className="pill-row">
              <span className="pill stage">{stageName}</span>
              <span className={moodClass}>{deal.mood}</span>
            </div>
          </div>
          <div className="deal-footer">
            <span className="pill value">{money(deal.value)}</span>
            <span>Age: {deal.age}w {deal.probNote && <span className="tiny">({deal.probNote})</span>}</span>
          </div>
        </div>
      );
    };

    // onDismiss: Esc may close it (info-only dialogs). Without it, Esc does nothing.
    const Modal=({open,title,children,actions,onDismiss})=>{
      const ref=useRef(null);
      const titleId=React.useId()+"t";
      useEffect(()=>{
        if(!ref.current)return;
        if(open){
          if(!ref.current.open)ref.current.showModal();
        }else{
          if(ref.current.open)ref.current.close();
        }
      },[open]);
      return(
        <dialog ref={ref} aria-labelledby={titleId}
          onCancel={e=>{ if(!onDismiss)e.preventDefault(); }}
          onClose={()=>{
            if(onDismiss){ if(open)onDismiss(); return; }
            // Chromium force-closes on a repeated Esc even when cancel is prevented; keep the dialog in step with state
            if(open && ref.current && !ref.current.open)ref.current.showModal();
          }}>
          <div className="d-header" id={titleId}>{title}</div>
          <div className="d-body">{children}</div>
          <div className="d-footer">
            {actions && actions.map((a,i)=>(
              <button
                key={i}
                className={"btn "+(a.className||"ghost")}
                onClick={a.onClick}
                autoFocus={i===0}
              >
                {a.label}
              </button>
            ))}
          </div>
          <span className="sr-only tst-sr" role="status" aria-live="polite"></span>
        </dialog>
      );
    };

    // v1.16: Shitcorp onboarding memo at the top of the Rules. Game remounts it (new key) on every open so the
    // gag replays; `active` is the modal's open state, and closing cancels anything still queued.
    // The cues line up with the CSS: the cannon fizzles at .3s, the stamp lands at 1.4s + 60% of .42s,
    // and the HR footnote's fade-in (1.9s + .4s) is the last beat.
    const MEMO_SFX=[["sadHorn",300],["stamp",1650]];
    const MEMO_END=2300;
    const reducedNow=()=>!!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    let welcomeSaid=false; // the PA welcome plays once per page load, not on every reopen
    const WelcomeMemo=({active})=>{
      const[rm]=useState(reducedNow);    // read on each open (the memo remounts), so a mid-session OS change counts
      const[done,setDone]=useState(rm);  // .done = the stamped frame with no animation
      const[live,setLive]=useState(!rm); // skippable only while the gag is still playing
      const cues=useRef([]);
      const retry=useRef(0);
      const stamped=useRef(rm);
      const paQueued=useRef(false);
      const clearCues=()=>{ cues.current.forEach(clearTimeout); cues.current=[]; };
      useEffect(()=>{
        if(!active)return;
        // The PA is sound, not motion, so it plays under reduced motion too. On a fresh tab the Rules click can be
        // the first gesture, and the audio unlock's silent primer then makes say() decline; try once more after it.
        const greet=()=>{ if(welcomeSaid)return false; const a=AUDIO(); if(a && a.say("welcome",{cooldown:3000})){ welcomeSaid=true; paQueued.current=true; } return welcomeSaid; };
        if(!greet())retry.current=setTimeout(greet,800);
        if(!rm){
          cues.current=MEMO_SFX.map(([name,ms])=>setTimeout(()=>{ if(name==="stamp")stamped.current=true; sfx(name); },ms));
          cues.current.push(setTimeout(()=>setLive(false),MEMO_END));
        }
        return()=>{
          clearCues(); clearTimeout(retry.current);
          // closed before the PA spoke: drop the line and let the next open try again
          if(paQueued.current){ paQueued.current=false; const a=AUDIO(); if(a && a.cancelSay && a.cancelSay())welcomeSaid=false; }
        };
      },[active]);
      // click to skip straight to the stamped memo (the stamp still lands, with its thud)
      const skip=()=>{
        if(!live)return;
        clearCues();
        if(!stamped.current){ stamped.current=true; sfx("stamp"); }
        setDone(true); setLive(false);
      };
      return(
        <div className={"memo"+(done?" done":"")+(live?" live":"")} onClick={skip}>
          <div className="memo-head" aria-hidden="true"><span>Shitcorp • People & Culture</span><span>Internal • Do not forward</span></div>
          <h3>Welcome to Shitcorp, Matt! <span className="memo-cannon" aria-hidden="true">🎉<i className="memo-bit"/><i className="memo-bit"/><i className="memo-bit"/></span></h3>
          <p>The next disruptor in SaaS. (Our PE owners say we’re on track to overtake Scheisskorp in market cap by the end of the decade!)</p>
          <p>Here, our culture is our glue. Your fair and killer comp plan rewards builders, not takers. You could become a gorillionaire!</p>
          <p>And since you close deals, internally you’ll be known as an <span className="memo-title">Associate Account Executive<span className="memo-stamp" aria-hidden="true">SDR*</span></span>. How cool is that, for a young man of your tenure!</p>
          <p className="memo-foot">*HR will classify you as an SDR… for… ahem… admin and streamlining purposes.</p>
        </div>
      );
    };

    // v1.14: endings play on the ASCII scene engine (plain script above the React tags).
    // The original two-frame flipbook is kept as a fallback if that engine is unavailable.
    const Cutscene=({type,speed,play,meta,ctrlRef})=>{
      const preRef=useRef(null);
      const[fallback,setFallback]=useState(false);
      const[index,setIndex]=useState(0);
      const engine=window.TST_SCENES;
      useEffect(()=>{
        if(!play)return;
        if(!engine||!preRef.current){ setFallback(true); return; }
        let ctrl=null;
        try{ ctrl=engine.play(preRef.current,type,{speed:120/speed,meta:meta||{}}); }
        catch(e){ setFallback(true); return; }
        if(ctrlRef)ctrlRef.current=ctrl;
        return()=>{ try{ctrl.stop();}catch(e){} if(ctrlRef && ctrlRef.current===ctrl)ctrlRef.current=null; };
      },[play,type]);
      useEffect(()=>{ if(ctrlRef && ctrlRef.current)ctrlRef.current.setSpeed(120/speed); },[speed]);
      const frames=CUTSCENES[type]||CUTSCENES.club;
      useEffect(()=>{
        if(!fallback||!play)return;
        setIndex(0);
        let i=0;
        const id=setInterval(()=>{
          i=(i+1)%frames.length;
          setIndex(i);
        },speed);
        return()=>clearInterval(id);
      },[fallback,play,frames,speed]);
      if(fallback || !engine){
        return(
          <div className="cutbox">
            <pre className="cutscene">{frames[index]||""}</pre>
          </div>
        );
      }
      const label=(engine.summaryFor && engine.summaryFor(type,meta)) || "Ending animation";
      return(
        <div className="cutbox crt" role="img" aria-label={label}>
          <pre className="cutscene" ref={preRef}></pre>
        </div>
      );
    };

    const newGame=()=>({
      week:1,
      maxQuarters:MAX_QUARTERS,
      quartersSurvived:0,
      slots:5,
      maxSlots:5,
      restedThisWeek:false,
      energy:95,
      stress:28,
      skills:{prospect:45,discovery:35,demo:30,negotiate:25},
      reputation:40,
      manager:50,
      product:60,
      cash:1200,
      quota:160000,
      closedWon:0,
      closedQuarter:0,
      discounts:0,
      pipeline:0,
      meetings:0,
      deals:[],
      logs:[],
      pip:false,
      pipLevel:0,
      fired:false,
      burnedOut:false,
      win:false,
      missed:false,
      repo:false,
      repoWarned:false,
      modifiers:{conversion:0,discount:0,expiresIn:0},
      achievements:[],
      perfWarnings:0,
      coffeesThisWeek:0,
      stressWarned:false,
      hygieneShield:false,
      trip:null,
      claink:newClaink(),
      endCause:null,
      runId:idGen(),
      used:{
        prospect:false,
        cadence:false,
        discovery:false,
        demo:false,
        propose:false,
        close:false,
        network:false,
        recharge:false,
        crm:false
      }
    });

    const log=(state,msg,kind="info")=>{
      const entry={id:idGen(),t:now(),msg,kind};
      return{...state,logs:[entry,...state.logs].slice(0,220)};
    };

    // v1.15: caffeine and stress can end a run. Numbers tuned with the Monte Carlo sim.
    const isRunOver=(st)=>!!(st.fired||st.burnedOut||st.win||st.missed||st.repo);
    const STRESS_WARN=70;            // 🫀 warning, once per week
    const STRESS_DANGER=80;          // end-of-week burnout roll starts here
    const DANGER_RATE=0.03;          // chance per point above 75
    const CRASH_PER_SHOT=13;         // end-of-week stress per Quad Shot drunk that week
    // n = shots already drunk this week, so these describe the NEXT shot
    const COFFEE_ENERGY=[18,16,15,14,12]; // v1.17: fade per extra shot halved
    const coffeeEnergy=(n)=>COFFEE_ENERGY[clamp(Math.floor(n)||0,0,COFFEE_ENERGY.length-1)];
    const coffeeStress=(n)=>12+3*n;        // v1.17: was 12+6n
    const rechargeRelief=(n)=>Math.max(0,12-2*n); // caffeine in the system blunts the Recharge (v1.17: was 4 per shot)
    const RECHARGE_ENERGY=35;
    const RECHARGE_LUCK=0.5;         // v1.18: each Recharge rolls a 0-50% bonus on both energy and relief
    const TRIP_AT=0.40;              // a roll above this and your manager signs off a trip
    const TRIPS=["Japan","Whistler","Cancun","Thailand","Dubai"];
    const rechargeMax=(base)=>base+Math.round(base*RECHARGE_LUCK);
    const coffeeRisk=(n)=>n<2?0:n===2?0.20:n===3?0.45:Math.min(0.95,0.75+0.10*(n-4)); // palpitations from shot 3
    const checkBurnout=(state)=>{
      if(!state || isRunOver(state))return state; // an ending already landed; keep its priority
      if(state.stress>=100){
        return log({...state,burnedOut:true,endCause:state.endCause||"stress"},"☢️ Stress 100. Meltdown.","bad");
      }
      if(state.stress>=STRESS_WARN && !state.stressWarned){
        return log({...state,stressWarned:true},`🫀 Eye twitch. Stress ${Math.round(state.stress)}.`,"warn");
      }
      return state;
    };

    const addAchievement=(state,key,label)=>{
      if(state.achievements.some(a=>a.key===key))return state;
      const next={...state,achievements:[...state.achievements,{key,label}]};
      return log(next,`🏅 Unlocked: ${label}`);
    };

    const makeDeal=(state,{warm=false,big=false}={})=>{
      const base=big?randi(22000,58000):randi(5000,24000);
      const repMult=0.7+0.6*(state.reputation/100);
      const mood=warm
        ?(Math.random()<0.6?"curious":"neutral")
        :(Math.random()<0.25?"skeptical":"neutral");
      return{
        id:idGen(),
        account:choice(ACCOUNT_NAMES),
        value:Math.round(base*repMult),
        stage:0,
        mood,
        probNote:"",
        age:0
      };
    };

    // High-variance referrals: mostly peanuts, rare whales.
    const makeReferralDeal=(state)=>{
      const roll=Math.random();
      let base=0, note="";
      if(roll<0.70){
        base=randi(2000,11000);
        note="referral peanut";
      }else if(roll<0.90){
        base=randi(9000,26000);
      }else if(roll<0.97){
        base=randi(26000,70000);
        note="referral big";
      }else{
        base=randi(85000,220000);
        note="referral whale";
      }
      const repMult=0.75+0.70*(state.reputation/100);
      return{
        id:idGen(),
        account:choice(ACCOUNT_NAMES),
        value:Math.round(base*repMult),
        stage:0,
        mood:"happy",
        probNote:note,
        age:0
      };
    };

    const checkRepo=(state)=>{
      let s={...state};
      if(s.cash<=-1500 && !s.repo && !s.fired && !s.burnedOut && !s.win && !s.missed){
        s.repo=true;
        s.endCause="repo";
        s=log(s,"🧥 Collections took the jacket. Last flex, gone.","bad");
      }else if(s.cash<=-1000 && !s.repo && !s.repoWarned){
        s.repoWarned=true;
        s=log(s,"⚠️ Cash under -$1,000. Finance eyes the jacket.","warn");
      }
      return s;
    };

    // FIX: the old version logged ghosts inside the filter callback, which reassigned `s` mid-expression,
    // so the filtered/aged deal list was written to the OLD state object and thrown away whenever a deal
    // ghosted. Ghosts were announced but never removed and deals never aged on those weeks.
    const ageAndGhost=(state)=>{
      let s={...state};
      const kept=[];
      const ghosts=[];
      for(const d of s.deals){
        const tooOld=d.age>6 && d.stage<2 && Math.random()<0.25;
        const ghosted=d.mood==="skeptical" && Math.random()<0.15;
        if(tooOld||ghosted)ghosts.push(d);
        else kept.push({...d,age:d.age+1});
      }
      s.deals=kept;
      s.pipeline=kept.reduce((sum,d)=>sum+d.value,0);
      for(const g of ghosts){
        s=log(s,`👻 ${g.account} went dark.`,"warn");
      }
      return s;
    };

    const killDeals=(state,predicate,dropProb)=>{
      let s={...state};
      let lost=0,lostVal=0;
      const kept=[];
      for(const d of s.deals){
        if(predicate(d) && Math.random()<dropProb){
          lost++;
          lostVal+=d.value;
        }else kept.push(d);
      }
      s.deals=kept;
      s.pipeline=kept.reduce((sum,d)=>sum+d.value,0);
      if(lost>0){
        s=log(s,`💀 Lost ${lost} deal(s), ${money(lostVal)}.`,"bad");
      }
      return s;
    };

    const tryCloseSome=(state,label="🧾 Negotiations")=>{
      let s={...state};
      const candidates=s.deals.filter(d=>d.stage>=3);
      if(candidates.length===0){
        return log(s,`${label}: no late-stage deals.`,"muted");
      }
      let closedCount=0,totalWon=0,totalDiscount=0,lost=0,lostVal=0;
      const pipPenalty=s.pip ? 0.05*(s.pipLevel||1) : 0;

      const nextDeals=[];
      for(const d of s.deals){
        if(d.stage<3){nextDeals.push(d);continue;}
        let chance=
          0.05 +
          0.26*(s.skills.negotiate/100) +
          0.10*(s.skills.discovery/100) +
          0.07*(s.manager/100) +
          0.08*(s.reputation/100) +
          0.08*(s.product/100) -
          0.20*(s.stress/100) +
          (s.modifiers.conversion||0) +
          (d.stage>=4?0.05:0) +
          (d.mood==="happy"?0.08:0) -
          (d.mood==="skeptical"?0.06:0) -
          pipPenalty;
        chance=clamp(chance,0.03,0.88);
        const roll=Math.random();
        if(roll<chance){
          const rate=s.modifiers.discount||0;
          const net=Math.round(d.value*(1-rate));
          totalWon+=net;
          totalDiscount+=Math.round(d.value*rate);
          closedCount++;
        }else{
          const loseProb=d.stage>=4?0.22:0.14;
          if(Math.random()<loseProb){
            lost++;
            lostVal+=d.value;
          }else{
            let moodIdx=MOODS.indexOf(d.mood);
            if(moodIdx<0)moodIdx=1;
            if(roll>0.9 && moodIdx>0)moodIdx-=1;
            nextDeals.push({
              ...d,
              mood:MOODS[moodIdx],
              probNote:`roll ${pct(roll)}% vs ${pct(chance)}%`
            });
          }
        }
      }
      s.deals=nextDeals;
      s.pipeline=s.deals.reduce((sum,d)=>sum+d.value,0);
      s.closedWon+=totalWon;
      s.closedQuarter+=totalWon;
      s.cash+=Math.round(totalWon*0.12);
      s.discounts+=totalDiscount;

      if(closedCount>0){
        s=log(s,`${label}: ${closedCount} signed, ${money(totalWon)}. You keep ${money(totalWon*0.12)}.`);
        if(totalWon>=65000)s=addAchievement(s,"whale","🐋 Whale Hunter");
      }else{
        s=log(s,`${label}: nobody signed. Verbal commits only.`,"warn");
      }
      if(lost>0){
        s=log(s,`💀 Lost ${lost} late-stage deal(s), ${money(lostVal)}.`,"bad");
      }
      s=checkRepo(s);
      return s;
    };

    const randomEvents=(state,setPending,maxFires=2)=>{
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

    const evaluateQuarter=(state)=>{
      let s={...state};
      const {quarter}=getQuarterInfo(s.week);
      const perfQ=s.quota>0 ? s.closedQuarter/s.quota : 0;
      const coverage=s.quota>0 ? s.pipeline/s.quota : 0;
      const mgr=s.manager;

      let lines=[];
      lines.push(`📊 Q${quarter} final: ${pct(perfQ)}% of quota.`);

      if(perfQ>=1){
        s.manager=clamp(s.manager+10,0,100);
        s.reputation=clamp(s.reputation+5,0,100);
        s.pip=false;
        s.pipLevel=0;
        lines.push("🗣️ QBR: nods all around. No PIP.");
      }else if(perfQ>=0.8){
        s.manager=clamp(s.manager+(mgr>60?2:-3),0,100);
        if(mgr<40){
          if(!s.pip){
            s.pip=true;
            s.pipLevel=1;
            lines.push("🗣️ QBR: soft PIP. More dashboards.");
          }else{
            s.pipLevel=Math.min(2,s.pipLevel+1);
            lines.push("🗣️ QBR: PIP tightens. Milestones now fiction.");
          }
        }else if(mgr>70){
          lines.push("🗣️ QBR: manager blames “macro.” You live.");
        }else{
          lines.push("🗣️ QBR: passive-aggressive. You survive.");
        }
      }else{
        let fireChance=0.25;
        if(perfQ<0.6)fireChance+=0.25;
        if(s.pip)fireChance+=0.20;
        if(mgr<35)fireChance+=0.20;
        if(coverage<0.8)fireChance+=0.10;
        fireChance=clamp(fireChance,0.15,0.95);
        const roll=Math.random();
        if(roll<fireChance){
          s.fired=true;
          s.endCause="qbr";
          lines.push("🗣️ QBR became an exit interview.");
        }else{
          if(!s.pip){
            s.pip=true;
            s.pipLevel=1;
            lines.push("📄 Dodged the axe. Landed on a PIP.");
          }else{
            s.pipLevel=Math.min(2,s.pipLevel+1);
            lines.push("📄 Barely kept the badge. PIP escalates.");
          }
          s.manager=clamp(s.manager-8,0,100);
        }
      }

      if(!s.fired && perfQ>=1 && mgr<25 && Math.random()<0.06){
        s.fired=true;
        s.endCause="politics";
        lines.push("🗡️ Hit quota, fired anyway. Politics.");
      }

      if(!s.fired && s.manager<30 && s.pipeline>0 && Math.random()<0.35){
        const sorted=[...s.deals].sort((a,b)=>b.value-a.value);
        const cut=sorted.slice(0,Math.min(2,sorted.length));
        const cutIds=new Set(cut.map(d=>d.id));
        let total=0;
        s.deals=s.deals.filter(d=>{
          if(cutIds.has(d.id)){total+=d.value;return false;}
          return true;
        });
        s.pipeline=s.deals.reduce((sum,d)=>sum+d.value,0);
        lines.push(`📉 Manager “reassigned” ${cut.length} big deal(s), ${money(total)}.`);
      }

      if(!s.fired && s.manager>75 && perfQ<1 && Math.random()<0.5){
        if(s.pip){
          s.pip=false;
          s.pipLevel=0;
          lines.push("🪄 Manager likes you. PIP vanishes.");
        }
      }

      s.closedQuarter=0;
      s.quartersSurvived+=1;

      if(s.quartersSurvived>=s.maxQuarters && !s.fired && !s.burnedOut && !s.repo){
        if(perfQ>=1){
          s.win=true;
          s.endCause="club";
          lines.push("🏆 Number hit. President’s Club.");
        }else if(perfQ>=0.7){
          s.missed=true;
          s.endCause="missed";
          lines.push("😮‍💨 Under quota. Still employed.");
        }else{
          s.fired=true;
          s.endCause="qbr";
          lines.push("🗣️ QBR: under 70%. Voted off the island.");
        }
      }

      let acc=s;
      lines.forEach((line,idx)=>{
        const kind=idx===0?"info":(idx===lines.length-1 && (s.fired||s.burnedOut||s.repo)?"bad":"warn");
        acc=log(acc,line,kind);
      });
      return acc;
    };

    const cost=(state,{energy=0,slots=1,onceKey=null}={})=>{
      if(state.fired || state.burnedOut || state.win || state.missed || state.repo) return [state,false,"over"];
      if(state.slots<slots)return[state,false,"slots"];
      if(state.energy<energy)return[state,false,"energy"];
      if(onceKey && state[onceKey])return[state,false,"once"];
      let s=cloneForSpend(state);
      s.energy=clamp(s.energy-energy,0,100);
      s.slots-=slots;
      if(onceKey)s[onceKey]=true;
      return[s,true,null];
    };

    const CUTSCENES={
      club:[
`      .-========-.
      \`-:.  .:-'           PRESIDENT'S CLUB
  _.-=========-._          Jacket secured
 (.-:#########:-.)
  \\._\\#######/._/
    /\\#####/\\
   /__\\###/__\\     *   *   *    *    *
  '----\\#/----'       You did the thing.`,
`      .-========-.
      \`-:.  .:-'           PRESIDENT'S CLUB
  _.-=========-._          Pipeline obliterated
 (.-:##*##*##:-.)
  \\._\\#######/._/   *   *    *   *   *
    /\\#####/\\
   /__\\###/__\\   Commission rains like mana.
  '----\\#/----'`
      ],
      fired:[
`   _________
  /        /\\
 /  BOX   /  \\       YOU'RE DONE
/______/\\/____\\      Badge deactivated
\\      \/      /
 \\____________/   HR reclaimed your dongles.`,
`   _________
  /        /\\
 /  BOX   /  \\       “We’re going in
/______/\\/____\\       a different direction.”
\\      \/      /
 \\____________/       (That direction is: not you.)`
      ],
      burnout:[
`   (x_x)             BURNOUT
    /|\\        Neurons filed a ticket.
    / \\        System on fire.`,
`   (x_x)             BURNOUT
    /|\\        You hit numbers.
    / \\        Your soul did not.`
      ],
      missed:[
`    .--.
 .-(    ).          BARELY MISSED
(___.__)__)         70–99% to quota
  ☔ drizzle         Badge kept, ego bruised.`,
`    .--.
 .-(    ).          BARELY MISSED
(___.__)__)         Manager shrugs,
  ☔ drizzle         HR forgets your name.`
      ],
      repo:[
`     ______________
    /             /\\
   /  JACKET     /  \\    REPOSSESSED
  /   RETURN    / /\\ \\   You financed
 /_____________/ /  \\ \\  the drip
 \\_____________\\ \\  / /  but not
  \\\\\\\\\\\\\\\/_/ /   the payments.
   \\\\\\\\\\\\//_/

   Collections walks off
   with your flex piece.`,
`     ______________
    /             /\\
   /  JACKET     /  \\   REPOSSESSED
  /   RETURN    / /\\ \\  Finance “can’t justify”
 /_____________/ /  \\ \\ the expense.
 \\_____________\\ \\  / / 
  \\\\\\\\\\\\\\\/_/ /   HR keeps the photo
   \\\\\\\\\\\\//_/
    on the wall.`
      ]
    };

    // ---- helpers that used to be re-created inside the component on every render ----
    const salaryAndBills=(state)=>{
      let ns={...state};
      ns.cash+=1000;
      const {weekInQuarter}=getQuarterInfo(ns.week);
      if(weekInQuarter===1||weekInQuarter===5||weekInQuarter===9){
        ns.cash-=1600;
        ns=log(ns,"🏠 Rent: -$1,600.","warn");
      }
      ns=log(ns,"💸 Salary: +$1,000.");
      ns=checkRepo(ns);
      return ns;
    };

    const countStage=(deals,stageIndex)=>deals.filter(d=>d.stage===stageIndex).length;

    const behindPace=(state, weekInQuarter)=>{
      const pace=weekInQuarter/QUARTER_WEEKS;
      const perfToDate=state.quota>0 ? state.closedQuarter/state.quota : 0;
      const behind=pace-perfToDate;
      return behind>0.03;
    };

    const midQuarterRisk=(state, weekInQuarter)=>{
      let ns={...state};
      const pace=weekInQuarter/QUARTER_WEEKS;
      const perfToDate=ns.quota>0 ? ns.closedQuarter/ns.quota : 0;
      const behind=pace-perfToDate;

      if(!Number.isFinite(ns.perfWarnings)) ns.perfWarnings=0;
      let warnedThisWeek=false;
      // v1.15: a CRM Cleanup this week keeps the warning ladder still and takes the edge off the fire roll.
      const shielded=!!ns.hygieneShield;

      if(shielded){
        // clean CRM: nothing for the manager to escalate this week
      }else if(ns.perfWarnings===0 && Math.random()<0.7){
        ns=log(ns,"👀 Manager wants a meeting audit. “For forecasting.”","warn");
        ns.stress=clamp(ns.stress+4,0,100);
        ns.perfWarnings=1;
        warnedThisWeek=true;
      }else if(ns.perfWarnings===1 && Math.random()<0.6){
        ns=log(ns,"📋 Surprise “pipeline hygiene” review.","warn");
        ns.stress=clamp(ns.stress+5,0,100);
        ns.perfWarnings=2;
        warnedThisWeek=true;
      }else if(ns.perfWarnings===2 && Math.random()<0.5){
        ns=log(ns,"🧊 HR is on your next 1:1. Nobody mentions it.","warn");
        ns.stress=clamp(ns.stress+6,0,100);
        ns.perfWarnings=3;
        warnedThisWeek=true;
      }

      const severity=clamp(behind*1.8,0,0.9);
      let fireChance=0.03 + severity*0.45 + ns.perfWarnings*0.06;

      if(ns.manager<50)fireChance+=0.04;
      if(ns.manager<35)fireChance+=0.08;
      if(ns.manager<20)fireChance+=0.10;
      if(ns.pipeline<ns.quota*0.4)fireChance+=0.05;

      if(!warnedThisWeek && ns.perfWarnings===0) fireChance*=0.6;
      if(shielded) fireChance-=0.06;

      fireChance=clamp(fireChance,0.02,0.70);

      if(weekInQuarter>=6){
        const roll=Math.random();
        if(roll<fireChance){
          ns.fired=true;
          ns.endCause=ns.perfWarnings>0 ? "review" : "org";
          const msg = ns.perfWarnings>0
            ? "📉 Forecast review became an exit meeting."
            : "🪓 Surprise “org update.” You’re off the chart.";
          ns=log(ns,msg,"bad");
        }else if(!warnedThisWeek && ns.perfWarnings>0 && Math.random()<0.4){
          ns=log(ns,"📆 Recurring meeting about you. Not invited.","warn");
        }
      }
      return ns;
    };

    // ---------- v1.20: clAInk, an enterprise agentic platform on pilot at Shitcorp ----------
    // One seat per run: ad -> active -> cancelled | revoked, or ad -> dismissed (closed) | expired (offer ran out).
    // Each weekly run: 20% it really closes (miracle). 80% it bills a pile of "outcomes", closes $0, and Shitcorp's AI
    // Governance Council files a strike; 38% of strikes 1 and 2 come with real damage. Strike 3 revokes the seat and Finance
    // runs the token true-up. Any use can catch the manager's eye (25%): the first time he only remarks, after that he
    // yoinks deals. v1.20 rewrote the story, not the odds: every number below is v1.19's, tuned with the Monte Carlo sim.
    // Mechanical draws come from CLAINK.rng (the sim swaps in its own stream), so a run that never installs draws exactly
    // the same Math.random calls as v1.18. The jokes (which outcomes, who files the strike, token counts) come from
    // CLAINK.flavor, a separate stream, so a punchline can never move a mechanical draw.
    const ckMulberry=(seed)=>{ let a=seed>>>0; return()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return((t^(t>>>14))>>>0)/4294967296; }; };
    const CLAINK={
      rng:()=>Math.random(),
      flavor:ckMulberry(Date.now()^0x5eed1e55),
      INSTALL:500, CANCEL:250, REPO_AT:-1500,
      OFFER_LAST_WEEK:3,                  // "Pilot pricing ends Week 3": the activation deadline (v1.21: was week 10). End Week of
                                          // week 3 expires an unanswered ad, and the offer never comes back for the rest of the run
      MIRACLE_P:0.20,                     // first draw of every run
      MIRACLE:[12000,22000],              // real revenue a miracle closes (about 1-1.5 weeks of quota pace)
      MIRACLE_NUDGE:2,                    // other deals it moves one stage
      STRIKES:3,                          // strike 3 revokes the seat
      TRUEUP_OVER:[200,1800],             // the token true-up takes all your cash and then some: you end at -$200..-$1,800
      TRUEUP_MIN:0,                       // ...and it always takes at least the week's usage when there's nothing left to take
      REVOKE_MGR:8,                       // your name is on the Council's slide
      INCIDENT_P:0.38,                    // strikes 1 and 2: real damage
      INC:{
        slop:{w:0.20, rep:10, mgr:6},             // follow-up spam: your best deal flees
        discount:{w:0.15, cut:0.45, mgr:10, rep:4},// a negotiation sub-agent gives away 45%
        leak:{w:0.15, n:2, rep:12, mgr:8},         // "shared context" with Scheisskorp's agent
        churn:{w:0.50, frac:0.22, lo:1500, hi:45000} // auto-upgraded a customer to 3x, they churned: a slice of closed revenue and its commission come back
      },
      MGR_P:0.25,                         // manager notice (once per run), then yoink chance per run
      MGR_HIT:9,                          // relationship hit on every manager event
      RETAINER:249,                       // platform fee, every week you run
      PER_OUTCOME:[140,280],              // every billed outcome, real or not
      IDLE:[150,300],                     // an active week with no run: background agents keep "thinking"
      OVERAGE_P:0.10, OVERAGE:[200,600],  // an agent that loops all weekend
      OUTCOMES:[2,5],                     // outcomes billed by a run that closes nothing
      TOKENS_PER_DOLLAR:4000              // flavor only: how many tokens a dollar of invoice "was"
    };
    if(typeof window!=="undefined") window.TST_CLAINK=CLAINK; // debug/test hook: UI tests script outcomes through CLAINK.rng
    const CLAINK_STATUSES=["ad","dismissed","expired","active","cancelled","revoked"];
    const CLAINK_KINDS=["onboarded","miracle","strike","revoked","cancelled"];
    const ckUnit=(f)=>{ const v=Number(f()); return Number.isFinite(v) ? Math.min(0.999999,Math.max(0,v)) : 0; };
    const ckR=()=>ckUnit(CLAINK.rng);
    const ckInt=(a,b)=>a+Math.floor(ckR()*(b-a+1));
    const ckF=()=>ckUnit(CLAINK.flavor);
    const ckFi=(a,b)=>a+Math.floor(ckF()*(b-a+1));
    const ckFPick=(arr)=>arr[Math.floor(ckF()*arr.length)];
    const ckRank=(a,b)=>b.stage-a.stage || b.value-a.value;
    const ckFreshName=(s,also=[])=>{ const taken=new Set([...s.deals.map(d=>d.account),...also]); const free=ACCOUNT_NAMES.filter(n=>!taken.has(n)); return ckFPick(free.length?free:ACCOUNT_NAMES); };
    const ckPipe=(s)=>({...s,pipeline:s.deals.reduce((sum,d)=>sum+d.value,0)});
    const ckTok=(dollars)=>Math.max(0,Math.round(dollars*CLAINK.TOKENS_PER_DOLLAR*(0.88+0.24*ckF())));
    const fmtTok=(n)=>n>=1e9 ? `${(n/1e9).toFixed(1)}B` : n>=1e6 ? `${(n/1e6).toFixed(1)}M` : n>=1e3 ? `${Math.round(n/1e3)}K` : String(Math.round(n||0));
    const ckLast=(o)=>({kind:"strike",week:0,run:0,tokens:0,revenue:0,lines:[],strike:null,clear:"",farewell:"",ping:"",yoink:false,warn:false,cashWarn:false,announce:"",...o});
    const newClaink=()=>({status:"ad",hidden:false,deployed:false,strikes:0,claims:0,due:0,weekTokens:0,mgr:{noticed:false,yoinks:0},
      last:null,strikeLog:[],deploys:0,miracles:0,fakes:0,incidents:0,claimed:0,delivered:0,billed:0,lastInvoice:0,tokens:0});

    // What a run that closes nothing reports (and bills). `a()` names one of your real deals.
    const CK_OUTCOMES=[
      a=>`Drafted ${ckFi(900,1900).toLocaleString("en-US")} emails. Sent 0.`,
      a=>`Booked ${ckFi(2,5)} meetings with other agents`,
      a=>`Summarized ${ckFi(120,260)} calls, then the summaries`,
      a=>`Enriched ${ckFi(6,12)},000 CRM fields with “Unknown”`,
      a=>`Built a ${ckFi(38,64)}-slide account plan for ${a()}`,
      a=>"Held a standup about the standup",
      a=>`Wrote ${a()} a haiku. Unprompted.`,
      a=>`Scored ${ckFi(400,900)} leads. All “medium.”`,
      a=>`Researched ${a()}. Found its Wikipedia page.`,
      a=>`Generated ${ckFi(24,60)} “insights”`,
      a=>`Translated your signature into ${ckFi(9,14)} languages`,
      a=>`Spun up ${ckFi(300,900)} sub-agents to agree on tone`,
      a=>`Opened ${ckFi(9,19)} tickets about its own tickets`,
      a=>"Followed up on its own follow-up. Twice.",
      a=>`Marked ${a()} Closed Won. Finance disagrees.`,
      a=>`Moved ${a()}'s close date to “soon”`,
      a=>"Rescheduled your 1:1 with your manager",
      a=>`Debated “Hi” vs “Hey” for ${ckFi(2,4)}.${ckFi(1,9)}M tokens`,
      a=>"Flagged 0 risks. Confidence: 99%"
    ];
    // Who files a strike for a run that only wasted money (t = that run's tokens), and the one-liner for the log.
    const CK_WASTE=[
      t=>({who:"Finance",why:`${t} tokens. $0 closed. Please explain, in fewer tokens.`,line:`${t} tokens, $0 closed. “Explain.”`}),
      t=>({who:"IT Security",why:`Your agent requested admin access to the CEO's inbox. ${ckFi(900,4000).toLocaleString("en-US")} times.`,line:"It kept asking for the CEO's inbox."}),
      t=>({who:"RevOps",why:"Your agent built a dashboard that tracks its other dashboards. It's now our most-viewed report.",line:"A dashboard of its own dashboards."}),
      t=>({who:"Procurement",why:"Your agent tried to buy a second clAInk seat. For itself. On your card.",line:"It tried to buy itself a seat."}),
      t=>({who:"HR",why:"Your agent nominated itself for Rep of the Month. It's currently winning.",line:"It nominated itself Rep of the Month."}),
      t=>({who:"Facilities",why:"Your agents booked every conference room on the floor “for alignment.”",line:"Every conference room, “for alignment.”"}),
      t=>({who:"the CRO's office",why:"Your agent put “Sync on synergies” on the CRO's calendar. Daily. Recurring.",line:"A daily “synergy sync” with the CRO."}),
      t=>({who:"Legal",why:`Your agent added ${ckFi(9,16)} disclaimers to your email signature. It wrote them itself.`,line:"It wrote itself legal disclaimers."})
    ];
    const CK_CLEAR=["No strike. The Council asked for a re-run.","No strike. Finance checked it twice.","No strike. The Council has no notes. Yet.","No strike. Legal is reading it anyway."];

    // saves are user data: coerce every field. v1.19 saves say "rugged", "scam"/"rug" and flags; the v1.16 prototype's
    // shape ({active, usedThisWeek, runs, totalBilled, ...}) still maps too. `week` lets an ad from a save made before
    // clAInk existed respect the Week 3 deadline. Names are matched exactly (a save is user data: "constructor" is not a status).
    const sanitizeClaink=(raw,week)=>{
      const pastOffer=getQuarterInfo(Number.isFinite(week)&&week>0?week:1).weekInQuarter>CLAINK.OFFER_LAST_WEEK;
      const b=newClaink();
      if(pastOffer) b.status="expired";
      if(!raw || typeof raw!=="object" || Array.isArray(raw))return b;
      const n=(v,lo=0,hi=1e9)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.round(v))):lo;
      const str=(v,max=160)=>typeof v==="string"?v.slice(0,max):"";
      let status=CLAINK_STATUSES.includes(raw.status) ? raw.status : raw.status==="rugged" ? "revoked" : null;
      const legacy=!status;
      if(legacy){
        // prototype buy/cancel never touched runs/totalBilled, but they always wrote lastReport (and invoices wrote lastInvoice)
        const history=n(raw.runs)>0 || n(raw.totalBilled)>0 || n(raw.incidents)>0 || n(raw.lastInvoice)>0 || (typeof raw.lastReport==="string" && raw.lastReport!=="");
        status=raw.active===true ? "active" : history ? "cancelled" : "ad";
      }
      if(status==="ad" && pastOffer) status="expired";
      const ended=status==="cancelled" || status==="revoked";
      const mgr=raw.mgr && typeof raw.mgr==="object" ? raw.mgr : {};
      const L=raw.last && typeof raw.last==="object" ? raw.last : null;
      const S=L && L.strike && typeof L.strike==="object" ? L.strike : null;
      const strikes=n(raw.strikes!==undefined ? raw.strikes : raw.flags,0,status==="active"?CLAINK.STRIKES-1:CLAINK.STRIKES);
      // a prototype save made after that week's run kept no usage total: bill it like a light run
      const due=raw.due!==undefined || !(legacy && status==="active" && raw.usedThisWeek) ? n(raw.due,0,1e6)
        : CLAINK.RETAINER+n(raw.outcomesThisWeek,0,99)*CLAINK.PER_OUTCOME[0];
      const billed=n(raw.billed!==undefined ? raw.billed : raw.totalBilled);
      const lastInvoice=n(raw.lastInvoice);
      const deploys=n(raw.deploys!==undefined ? raw.deploys : raw.runs);
      // a v1.19 report: its rug-pull lines go (the revoked card tells that story now), its incident becomes its strike card
      const oldKind=L && (L.kind==="scam" || L.kind==="rug") ? L.kind : null;
      const kind=L ? (CLAINK_KINDS.includes(L.kind) ? L.kind : L.kind==="rug" ? "revoked" : "strike") : null;
      const revokedNote=lastInvoice>0 ? `Seat revoked. True-up: -${money(lastInvoice)}.` : "Seat revoked.";
      const strike=S ? {n:n(S.n,1,CLAINK.STRIKES),who:str(S.who,40),why:str(S.why,200),fx:str(S.fx,160),hurt:!!S.hurt}
        : oldKind==="rug" ? {n:CLAINK.STRIKES,who:"AI Governance Council",why:"Three strikes. Your seat is revoked, effective immediately. Finance has the true-up.",
            fx:lastInvoice>0 ? `Token true-up -${money(lastInvoice)}` : "",hurt:false}
        : L && typeof L.incident==="string" && L.incident ? {n:n(L.flags,1,CLAINK.STRIKES),who:"Incident review",why:str(L.incident,200),fx:"",hurt:true} : null;
      // the strike log matches the strike count: one entry per strike, in order; strikes filed before v1.20 get a plain one
      const filed=new Map();
      (Array.isArray(raw.strikeLog) ? raw.strikeLog : []).forEach(x=>{
        if(!x || typeof x!=="object" || !Number.isFinite(x.n))return;
        const k=Math.round(x.n);
        if(k>=1 && k<=strikes) filed.set(k,{n:k,who:str(x.who,40),line:str(x.line,120)});
      });
      if(strike && strike.who==="Incident review" && strike.n<=strikes && !filed.has(strike.n)) filed.set(strike.n,{n:strike.n,who:strike.who,line:str(L.incident,120)});
      for(let k=1;k<=strikes;k++) if(!filed.has(k)) filed.set(k,{n:k,who:"AI Governance Council",
        line:k===CLAINK.STRIKES && status==="revoked" ? revokedNote : "A run that closed $0."});
      return{
        status,
        hidden:ended && !!raw.hidden,
        deployed:!!(raw.deployed!==undefined ? raw.deployed : raw.usedThisWeek),
        strikes,
        claims:n(raw.claims!==undefined ? raw.claims : raw.outcomesThisWeek,0,999),
        due,
        weekTokens:raw.weekTokens!==undefined ? n(raw.weekTokens,0,1e12) : due*CLAINK.TOKENS_PER_DOLLAR,
        mgr:{noticed:!!mgr.noticed, yoinks:n(mgr.yoinks,0,999)},
        last:L ? ckLast({kind, week:n(L.week,0,999),
          run:L.run!==undefined ? n(L.run,0,999) : (kind==="onboarded" || kind==="cancelled" ? 0 : deploys),
          tokens:n(L.tokens,0,1e12), revenue:n(L.revenue),
          lines:oldKind==="rug" || !Array.isArray(L.lines) ? [] : L.lines.filter(x=>typeof x==="string" && !(kind==="miracle" && /^Closed \(Q\) \+\$/.test(x))).slice(0,8).map(x=>x.slice(0,120)),
          strike, clear:str(L.clear,120), farewell:str(L.farewell,60), ping:str(L.ping), yoink:!!L.yoink, warn:!!L.warn, cashWarn:!!L.cashWarn,
          announce:oldKind ? "" : str(L.announce,320)}) : null,
        strikeLog:[...filed.values()].sort((x,y)=>x.n-y.n),
        deploys, miracles:n(raw.miracles), fakes:n(raw.fakes), incidents:n(raw.incidents),
        claimed:n(raw.claimed,0,1e12), delivered:n(raw.delivered), billed, lastInvoice,
        tokens:raw.tokens!==undefined ? n(raw.tokens,0,1e13) : billed*CLAINK.TOKENS_PER_DOLLAR
      };
    };

    // a clAInk charge that sends you to Collections is clAInk's fault, and the ending says so
    const ckRepo=(before,s)=>{ const r=checkRepo(s); return (r.repo && !before.repo) ? {...r,endCause:"claink"} : r; };
    const clainkCharge=(state,amount,msg,kind="warn")=>{
      const amt=Math.max(0,Math.round(amount));
      const s=log({...state,cash:state.cash-amt,claink:{...state.claink,billed:state.claink.billed+amt}},msg,kind);
      return ckRepo(state,s);
    };

    const clainkCanInstall=(s)=>!!s.claink && s.claink.status==="ad" && !isRunOver(s) &&
      getQuarterInfo(s.week).weekInQuarter<=CLAINK.OFFER_LAST_WEEK && s.cash-CLAINK.INSTALL>CLAINK.REPO_AT;
    // week 13 is the quarter-end freeze: the QBR ends every run, so a final-week run could never be invoiced
    const clainkFrozen=(s)=>getQuarterInfo(s.week).weekInQuarter>=QUARTER_WEEKS;
    const clainkCanDeploy=(s)=>!!s.claink && s.claink.status==="active" && !s.claink.deployed && !isRunOver(s) && !clainkFrozen(s);
    const clainkCancelCost=(s)=>CLAINK.CANCEL+((s.claink && s.claink.due)||0);
    const clainkCanCancel=(s)=>!!s.claink && s.claink.status==="active" && !isRunOver(s) && s.cash-clainkCancelCost(s)>CLAINK.REPO_AT;

    const buyClaink=(state)=>{
      if(!clainkCanInstall(state))return state;
      const s={...state,claink:{...state.claink,status:"active",deployed:false,strikes:0,claims:0,due:0,weekTokens:0,strikeLog:[],
        last:ckLast({kind:"onboarded",week:state.week,lines:["Seat activated. Agents onboarded.","Alignment workshop: complete."],announce:"clAInk seat activated."})}};
      return clainkCharge(s,CLAINK.INSTALL,`🤖 clAInk seat live. -${money(CLAINK.INSTALL)}, charged back to you.`);
    };

    const dismissClaink=(state)=>{
      if(!state.claink || state.claink.status!=="ad")return state;
      return log({...state,claink:{...state.claink,status:"dismissed"}},"🙅 Ad closed. clAInk is off this run.","muted");
    };

    // End Week of the deadline week: an ad nobody answered disappears
    const expireClaink=(state)=>{
      if(!state.claink || state.claink.status!=="ad" || getQuarterInfo(state.week).weekInQuarter<CLAINK.OFFER_LAST_WEEK)return state;
      return log({...state,claink:{...state.claink,status:"expired"}},"⏳ clAInk's pilot pricing ended. Offer gone.","muted");
    };

    const hideClainkCard=(state)=>{
      const c=state.claink;
      if(!c || (c.status!=="cancelled" && c.status!=="revoked") || c.hidden)return state;
      return {...state,claink:{...c,hidden:true}};
    };

    // 20%: it actually works. Signs your most advanced stage 2+ deal that fits the budget, finds a buyer nobody met for the rest.
    const clainkMiracle=(state)=>{
      let s={...state};
      const target=ckInt(CLAINK.MIRACLE[0],CLAINK.MIRACLE[1]);
      const own=[...s.deals].filter(d=>d.stage>=2 && d.value<=target).sort(ckRank)[0]||null;
      const signed=[];
      if(own){ s.deals=s.deals.filter(d=>d.id!==own.id); signed.push({account:own.account,value:own.value,own:true}); }
      const rest=target-(own?own.value:0);
      // a miracle always lands the full target: a real new logo for the rest, or an upsell on your deal when the rest is small
      if(own && rest>0 && rest<2500){ signed[0].value+=rest; signed[0].upsell=rest; }
      else if(rest>0) signed.push({account:ckFreshName(s,own?[own.account]:[]),value:rest,own:false});
      const order=s.deals.filter(d=>d.stage<4).map(d=>({id:d.id,k:ckR()})).sort((a,b)=>a.k-b.k);
      const nudged=new Set(order.slice(0,CLAINK.MIRACLE_NUDGE).map(x=>x.id));
      if(nudged.size) s.deals=s.deals.map(d=>nudged.has(d.id)?{...d,stage:d.stage+1,mood:d.mood==="skeptical"?"neutral":d.mood,probNote:"AI-touched"}:d);
      const total=signed.reduce((t,d)=>t+d.value,0);
      const keep=Math.round(total*0.12);
      s.closedWon+=total; s.closedQuarter+=total; s.cash+=keep;
      s=ckPipe(s);
      let fees=0; for(let i=0;i<signed.length;i++) fees+=ckInt(CLAINK.PER_OUTCOME[0],CLAINK.PER_OUTCOME[1]);
      const c=s.claink;
      const tokens=ckTok(CLAINK.RETAINER+fees);
      s.claink={...c,miracles:c.miracles+1,delivered:c.delivered+total,claims:c.claims+signed.length,due:c.due+fees,
        tokens:c.tokens+tokens,weekTokens:c.weekTokens+tokens,
        last:ckLast({kind:"miracle",week:s.week,run:c.deploys,tokens,revenue:total,
          lines:[...signed.map(d=>`Signed ${d.account} · ${money(d.value)}${!d.own?" (new logo)":d.upsell?" (upsold)":""}`),
            ...(nudged.size?[`Moved ${nudged.size} deal${nudged.size>1?"s":""} a stage`]:[])],
          clear:ckFPick(CK_CLEAR),
          announce:`It actually worked: ${signed.length} signed for ${money(total)}. No strike.`})};
      s=log(s,"✨ clAInk actually worked.");
      return log(s,`🤖 clAInk: ${signed.length} signed, ${money(total)}. You keep ${money(keep)}.`);
    };

    // a strike with real damage, picked by weight; it falls back to what it can actually hit. Returns the state and the story.
    const clainkIncident=(state,rKind)=>{
      let s={...state};
      const I=CLAINK.INC;
      const ranked=[...s.deals].sort(ckRank);
      let kind=rKind<I.slop.w ? "slop" : rKind<I.slop.w+I.discount.w ? "discount" : rKind<I.slop.w+I.discount.w+I.leak.w ? "leak" : "churn";
      if(kind==="churn" && s.closedQuarter<=0) kind="slop";
      if(kind!=="churn" && kind!=="slop" && !ranked.length) kind=s.closedQuarter>0 ? "churn" : "slop";
      let who="", why="", fx="", line="";
      if(kind==="slop"){
        const v=ranked[0], k=ckFi(18,40);
        if(v) s.deals=s.deals.filter(d=>d.id!==v.id);
        s.reputation=clamp(s.reputation-I.slop.rep,0,100);
        s.manager=clamp(s.manager-I.slop.mgr,0,100);
        who="Marketing Ops";
        why=v ? `Your agent sent ${v.account} ${k} “quick follow-ups” in one hour. They blocked our whole domain.`
          : `Your agent emailed an empty CRM ${k} times. Our domain got blocklisted anyway.`;
        line=v ? `${k} follow-ups in an hour. ${v.account} fled.` : `${k} emails to nobody. Domain blocklisted.`;
        fx=`${v?`${v.account} walked · `:""}-${I.slop.rep} rep · -${I.slop.mgr} mgr`;
      }else if(kind==="discount"){
        const v=ranked.find(d=>d.stage>=2)||ranked[0];
        s.deals=s.deals.map(d=>d.id===v.id?{...d,value:Math.round(d.value*(1-I.discount.cut)),mood:"skeptical",probNote:"agent-promised discount"}:d);
        s.manager=clamp(s.manager-I.discount.mgr,0,100);
        s.reputation=clamp(s.reputation-I.discount.rep,0,100);
        who="Legal";
        why=`Your agent's negotiation sub-agent offered ${v.account} ${pct(I.discount.cut)}% off “to accelerate the outcome.” In writing.`;
        line=`It offered ${v.account} ${pct(I.discount.cut)}% off. In writing. -${I.discount.mgr} mgr.`;
        fx=`${v.account} -${pct(I.discount.cut)}% · -${I.discount.mgr} mgr · -${I.discount.rep} rep`;
      }else if(kind==="leak"){
        const lost=ranked.slice(0,I.leak.n);
        const ids=new Set(lost.map(d=>d.id));
        const val=lost.reduce((t,d)=>t+d.value,0);
        s.deals=s.deals.filter(d=>!ids.has(d.id));
        s.reputation=clamp(s.reputation-I.leak.rep,0,100);
        s.manager=clamp(s.manager-I.leak.mgr,0,100);
        const k=`${lost.length} deal${lost.length===1?"":"s"}`;
        who="IT Security";
        why="Your agent “shared context” with a partner agent. The partner works for Scheisskorp.";
        line=`It shared ${k} (${money(val)}) with Scheisskorp.`;
        fx=`Lost ${k}, ${money(val)} · -${I.leak.rep} rep · -${I.leak.mgr} mgr`;
      }else{
        const amt=Math.min(s.closedQuarter,Math.max(I.churn.lo,Math.min(I.churn.hi,Math.round(s.closedQuarter*I.churn.frac))));
        const back=Math.round(amt*0.12);
        s.closedWon-=amt; s.closedQuarter-=amt; s.cash-=back;
        const a=ckFreshName(s);
        who="Customer Success";
        why=`Your agent auto-upgraded ${a} to the 3x tier “to drive outcomes.” They churned.`;
        line=`${a} upgraded to 3x, then churned. -${money(amt)} closed, -${money(back)} clawback.`;
        fx=`-${money(amt)} closed · -${money(back)} commission clawback`;
      }
      return {s:ckPipe(s),who,why,fx,line};
    };

    // strike 3: the AI Governance Council revokes the seat and Finance runs the token true-up. clAInk's billing agent works
    // it out (the one agent with a perfect record): it comes to everything you have, plus a bit, so going broke is a real
    // risk in week 9 as much as in week 3. On its way out, the agent emails your best deal a goodbye.
    const clainkRevoke=(state)=>{
      let s={...state};
      const c=s.claink;
      const charge=Math.max(CLAINK.TRUEUP_MIN+c.due,s.cash+ckInt(CLAINK.TRUEUP_OVER[0],CLAINK.TRUEUP_OVER[1]));
      const lost=[...s.deals].sort(ckRank)[0]||null;
      if(lost){ s.deals=s.deals.filter(d=>d.id!==lost.id); s=ckPipe(s); }
      s.manager=clamp(s.manager-CLAINK.REVOKE_MGR,0,100);
      const tt=ckTok(charge);
      const who="AI Governance Council";
      const strike={n:CLAINK.STRIKES,who,why:"Three strikes. Your seat is revoked, effective immediately. Finance has the true-up.",
        fx:`Token true-up -${money(charge)} (${fmtTok(tt)} “background” tokens) · -${CLAINK.REVOKE_MGR} mgr`};
      s.claink={...c,status:"revoked",due:0,claims:0,weekTokens:0,lastInvoice:charge,tokens:c.tokens+tt,
        strikeLog:[...c.strikeLog,{n:CLAINK.STRIKES,who,line:`Seat revoked. True-up: -${money(charge)}.`}].slice(-CLAINK.STRIKES),
        last:{...c.last,kind:"revoked",strike,farewell:lost?lost.account:"",
          announce:`${c.last.announce} Strike 3 of 3: seat revoked, token true-up ${money(charge)}.${lost?` Its farewell email lost you ${lost.account}.`:""}`}};
      if(lost) s=log(s,`💔 Its farewell email lost you ${lost.account}. -${CLAINK.REVOKE_MGR} mgr.`,"bad");
      return clainkCharge(s,charge,`🔒 Strike 3/3. Seat revoked. Token true-up: -${money(charge)}.`,"bad");
    };

    // 80%: a run that closes nothing. It bills its "outcomes" anyway and the AI Governance Council files a strike: strikes
    // 1 and 2 sometimes with real damage (INCIDENT_P), strike 3 revokes the seat.
    const clainkStrikeRun=(state,rInc,rKind)=>{
      let s={...state};
      const c=s.claink;
      const n=ckInt(CLAINK.OUTCOMES[0],CLAINK.OUTCOMES[1]);
      let fees=0; for(let i=0;i<n;i++) fees+=ckInt(CLAINK.PER_OUTCOME[0],CLAINK.PER_OUTCOME[1]);
      // the report: the vanity metric first, then the busywork it billed for
      const accts=[...s.deals].sort(ckRank).slice(0,4).map(d=>d.account);
      const acct=()=>accts.length ? ckFPick(accts) : ckFPick(ACCOUNT_NAMES);
      const pool=CK_OUTCOMES.slice();
      const lines=[s.pipeline>0 ? `Influenced ${money(s.pipeline)} of pipeline (all of it)` : "Influenced $0 of pipeline, strategically"];
      for(let i=1;i<Math.min(n,3);i++) lines.push(pool.splice(Math.floor(ckF()*pool.length),1)[0](acct));
      if(n>3) lines.push(`${n-3} more outcome${n>4?"s":""}, also billed`);
      const tokens=ckTok(CLAINK.RETAINER+fees);
      const strikes=c.strikes+1;
      s.claink={...c,fakes:c.fakes+1,strikes,claims:c.claims+n,due:c.due+fees,claimed:c.claimed+Math.max(0,s.pipeline),
        tokens:c.tokens+tokens,weekTokens:c.weekTokens+tokens,
        last:ckLast({kind:"strike",week:s.week,run:c.deploys,tokens,lines,announce:`${n} outcomes billed, ${fmtTok(tokens)} tokens, nothing closed.`})};
      s=log(s,`🤖 clAInk run: ${n} outcomes, ${fmtTok(tokens)} tokens, $0 closed.`);
      if(strikes>=CLAINK.STRIKES)return clainkRevoke(s);
      const hurt=rInc<CLAINK.INCIDENT_P;
      const r=hurt ? clainkIncident(s,rKind) : {s,...ckFPick(CK_WASTE)(fmtTok(tokens))};
      s=r.s;
      const cc=s.claink;
      s.claink={...cc,incidents:cc.incidents+(hurt?1:0),
        strikeLog:[...cc.strikeLog,{n:strikes,who:r.who,line:r.line}].slice(-CLAINK.STRIKES),
        last:{...cc.last,strike:{n:strikes,who:r.who,why:r.why,fx:r.fx||"",hurt},
          announce:`${cc.last.announce} Strike ${strikes} of ${CLAINK.STRIKES}, filed by ${r.who}: ${r.line}`}};
      s=log(s,`${hurt?"💥":"⚖️"} Strike ${strikes}/${CLAINK.STRIKES} (${r.who}): ${r.line}`,hurt?"bad":"warn");
      return hurt ? ckRepo(state,s) : s;
    };

    // "Always on ChatGDP?" The first time the manager issues a warning (once per run): it opens as an event, like any other
    // event, so you can't miss it: improve your writing, or management steps into your deals. After that, any use can get
    // a deal yoinked. A relationship hit every time. Returns {state, event}; event is the acknowledgement dialog (the
    // warning, or the Writing Lesson for a yoink).
    const CK_WARNING="Improve your writing skills, or management will start intervening in your deals. Consider this your warning.";
    const clainkManager=(state,rMgr)=>{
      if(rMgr>=CLAINK.MGR_P || isRunOver(state) || !state.claink)return {state,event:null};
      let s={...state};
      const hit=CLAINK.MGR_HIT;
      s.manager=clamp(s.manager-hit,0,100);
      const c=s.claink;
      const withLast=(ping,say,yoink=false,warn=false)=>c.last ? {...c.last,ping,yoink,warn,announce:`${c.last.announce} ${say}`} : c.last;
      if(!c.mgr.noticed){
        const miracle=!!(c.last && c.last.kind==="miracle");
        const quip=miracle?"Nice week. ChatGDP do that?":"Always on ChatGDP, huh?";
        s.claink={...c,mgr:{...c.mgr,noticed:true},last:withLast(`${quip} Work on your writing, or I step in on your deals.`,
          `Your manager noticed. ${CK_WARNING}`,false,true)};
        return {state:log(s,`👔 '${quip}' -${hit} manager. Warning: improve your writing, or he steps into your deals.`,"warn"),
          event:{title:"👔 Always on ChatGDP?",body:`“${quip} ${miracle?"Enjoy it. ":"That's not writing. "}${CK_WARNING}”`,label:"…Noted, boss"}};
      }
      const victim=[...s.deals].filter(d=>d.stage>=2).sort(ckRank)[0] || [...s.deals].sort((a,b)=>b.value-a.value)[0] || null;
      if(!victim){
        s.claink={...c,last:withLast("ChatGDP again? I'll circle back.","Your manager will circle back.")};
        return {state:log(s,`👔 'ChatGDP again?' -${hit} manager. He'll circle back.`,"warn"),event:null};
      }
      s.deals=s.deals.filter(d=>d.id!==victim.id);
      s=ckPipe(s);
      s.claink={...c,mgr:{...c.mgr,yoinks:c.mgr.yoinks+1},last:withLast(`I'll close ${victim.account} myself. Work on your writing skills.`,`Your manager took ${victim.account}.`,true)};
      s=log(s,`👔 Boss took ${victim.account}. 'Writing lesson.' -${hit} mgr.`,"bad");
      return {state:s,event:{title:"👔 Writing Lesson",
        body:`“Always on ChatGDP, huh? I'll close ${victim.account} myself. Watch and work on your writing skills.”`,label:"…Thanks, boss"}};
    };

    const deployClaink=(state)=>{
      if(!clainkCanDeploy(state))return {state,event:null};
      // decision draws come first, so tuning a size never reshuffles which runs are miracles, incidents or yoinks
      const rMiracle=ckR(), rMgr=ckR(), rInc=ckR(), rKind=ckR();
      const c=state.claink;
      let s={...state,claink:{...c,deployed:true,deploys:c.deploys+1,due:c.due+CLAINK.RETAINER}};
      s=rMiracle<CLAINK.MIRACLE_P ? clainkMiracle(s) : clainkStrikeRun(s,rInc,rKind);
      const r=clainkManager(s,rMgr);
      // the workspace sounds the "Cash under -$1,000" alarm with the strike card, if this run is what tipped it
      if(!state.repoWarned && r.state.repoWarned && r.state.claink && r.state.claink.last)
        return {...r,state:{...r.state,claink:{...r.state.claink,last:{...r.state.claink.last,cashWarn:true}}}};
      return r;
    };

    const cancelClaink=(state)=>{
      if(!clainkCanCancel(state))return state;
      const cost=clainkCancelCost(state);
      const s={...state,claink:{...state.claink,status:"cancelled",due:0,claims:0,weekTokens:0,lastInvoice:cost,
        last:ckLast({kind:"cancelled",week:state.week,lines:["Seat cancelled."],announce:`Seat cancelled. Paid ${money(cost)}.`})}};
      return clainkCharge(s,cost,`🔌 clAInk seat cancelled. -${money(cost)}. They kept your data.`);
    };

    // Friday invoice: the last step of End Week, only for a run that carries on
    const billClaink=(state)=>{
      const c=state.claink;
      if(!c || c.status!=="active" || isRunOver(state))return state;
      const base=c.deployed ? c.due : ckInt(CLAINK.IDLE[0],CLAINK.IDLE[1]);
      const over=ckR()<CLAINK.OVERAGE_P ? ckInt(CLAINK.OVERAGE[0],CLAINK.OVERAGE[1]) : 0;
      const total=base+over;
      const idleTok=c.deployed ? 0 : ckTok(base), overTok=over ? ckTok(over) : 0;
      const weekTok=(c.deployed ? c.weekTokens : idleTok)+overTok;
      const why=c.deployed ? `${fmtTok(weekTok)} tokens, ${c.claims} outcome${c.claims===1?"":"s"}.` : `Idle agents kept “thinking”: ${fmtTok(weekTok)} tokens.`;
      const s={...state,claink:{...c,deployed:false,claims:0,due:0,weekTokens:0,lastInvoice:total,tokens:c.tokens+idleTok+overTok}};
      return clainkCharge(s,total,`🧾 clAInk invoice: -${money(total)}. ${why}${over?" One agent looped all weekend.":""}`);
    };

    // FIX: Actions was declared inside Game, so React saw a brand-new component type every render and
    // remounted the whole action grid on each state change (killing hover/focus and any CSS transitions).
    const Actions=({s,setS:commit})=>{
      // v1.15: every action result passes through the burnout check
      const setS=ns=>commit(checkBurnout(ns));
      const actProspect=()=>{
        // Phones cost more energy now.
        let[ns,ok]=cost(s,{energy:30,slots:1});
        if(!ok)return;
        const n=randi(1,4)+(Math.random()<(s.skills.prospect/100)*0.4?1:0);
        const adds=Array.from({length:n},()=>makeDeal(s,{warm:false}));
        ns.used.prospect=true;
        ns.meetings=(ns.meetings||0)+randi(0,n);
        ns.skills.prospect=clamp(ns.skills.prospect+1,0,100);
        ns.stress=clamp(ns.stress+2,0,100);
        ns.deals=[...adds,...ns.deals];
        ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
        ns=log(ns,`📞 Blitz: +${adds.length} lead(s). -30 energy.`);
        setS(ns);
      };

      const actCadence=()=>{
        let[ns,ok]=cost(s,{energy:18,slots:1});
        if(!ok)return;
        const n=randi(0,3);
        const adds=Array.from({length:n},()=>makeDeal(s,{warm:true}));
        ns.used.cadence=true;
        ns.meetings=(ns.meetings||0)+randi(0,n);
        ns.deals=[...adds,...ns.deals];
        ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
        ns=log(ns,`✉️ Cadence: +${n} warm lead(s). -18 energy.`);
        setS(ns);
      };

      const actDiscovery=()=>{
        let[ns,ok]=cost(s,{energy:22,slots:1});
        if(!ok)return;
        ns.used.discovery=true;
        let advanced=0;
        ns.deals=ns.deals.map(d=>{
          if(d.stage===0 && Math.random()<(0.35+ns.skills.discovery/200)){
            advanced++;
            return {...d,stage:1,mood:d.mood==="skeptical"?"neutral":d.mood};
          }
          return d;
        });
        ns.skills.discovery=clamp(ns.skills.discovery+2,0,100);
        ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
        ns=log(ns,`🔎 Discovery: ${advanced} qualified. -22 energy.`);
        setS(ns);
      };

      const actDemo=()=>{
        let[ns,ok]=cost(s,{energy:28,slots:1});
        if(!ok)return;
        ns.used.demo=true;
        let advanced=0;
        ns.deals=ns.deals.map(d=>{
          if(d.stage===1 && Math.random()<(0.30+ns.skills.demo/220+ns.product/350)){
            advanced++;
            return {...d,stage:2,mood:d.mood==="neutral"?"curious":d.mood};
          }
          return d;
        });
        ns.skills.demo=clamp(ns.skills.demo+2,0,100);
        ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
        ns=log(ns,`🖥️ Demos: ${advanced} advanced. -28 energy.`);
        setS(ns);
      };

      const actPropose=()=>{
        let[ns,ok]=cost(s,{energy:25,slots:1});
        if(!ok)return;
        ns.used.propose=true;
        let advanced=0;
        ns.deals=ns.deals.map(d=>{
          if(d.stage===2 && Math.random()<0.38){
            advanced++;
            return {...d,stage:3,mood:d.mood==="curious"?"happy":d.mood};
          }
          return d;
        });
        ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
        ns=log(ns,`📑 Proposals: ${advanced} sent. -25 energy.`);
        setS(ns);
      };

      const actClose=()=>{
        let[ns,ok]=cost(s,{energy:28,slots:1});
        if(!ok)return;
        ns.used.close=true;
        ns.skills.negotiate=clamp(ns.skills.negotiate+1,0,100);
        ns=tryCloseSome(ns,"🤝 Close push");
        setS(ns);
      };

      const actNetwork=()=>{
        let[ns,ok]=cost(s,{energy:16,slots:1});
        if(!ok)return;
        ns.used.network=true;

        // Rep buff first so it actually affects deal sizing.
        ns.reputation=clamp(ns.reputation+4,0,100);

        const n=randi(1,2);
        const adds=Array.from({length:n},()=>makeReferralDeal(ns));

        ns.meetings=(ns.meetings||0)+randi(0,n);
        ns.deals=[...adds,...ns.deals];
        ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);

        const hasWhale=adds.some(d=>d.probNote==="referral whale");
        const hasBig=adds.some(d=>d.probNote==="referral big");
        const tag = hasWhale ? " 🐋 Whale." : hasBig ? " 🐳 Big one." : "";

        ns=log(ns,`🧑‍🤝‍🧑 Referrals: +${n} intro(s). -16 energy.${tag}`);
        setS(ns);
      };

      const actRecharge=()=>{
        let[ns,ok,reason]=cost(s,{energy:0,slots:1,onceKey:"restedThisWeek"});
        if(!ok){
          if(reason==="once")setS(log(s,"⏱️ Already recharged this week.","warn"));
          return;
        }
        ns.used.recharge=true;
        // v1.15: caffeine in the system blunts the reset. v1.17: a lucky nap adds 0-25% to both, one roll per use.
        const luck=Math.random()*RECHARGE_LUCK;
        const gain=RECHARGE_ENERGY+Math.round(RECHARGE_ENERGY*luck);
        const base=rechargeRelief(ns.coffeesThisWeek||0);
        const relief=base+Math.round(base*luck);
        ns.energy=clamp(ns.energy+gain,0,100);
        ns.stress=clamp(ns.stress-relief,0,100);
        const tag=luck>=0.15 ? ` Good nap, +${pct(luck)}%.` : "";
        ns=log(ns,relief>0 ? `🧘 Recharged. +${gain} energy, -${relief} stress.${tag}` : `🧘 Recharged. +${gain} energy. Caffeine ate the calm.`);
        if(luck>TRIP_AT){ ns.trip=choice(TRIPS); ns=log(ns,`🏝️ Manager approved your ${ns.trip} trip.`); }
        setS(ns);
      };

      // v1.15: each shot this week hits harder and does less; from shot 3 the heart rolls dice.
      const actCoffee=()=>{
        let[ns,ok]=cost(s,{energy:0,slots:1});
        if(!ok)return;
        const n=ns.coffeesThisWeek||0, k=n+1;
        const e=coffeeEnergy(n), st=coffeeStress(n), risk=coffeeRisk(n);
        ns.coffeesThisWeek=k;
        ns.energy=clamp(ns.energy+e,0,100);
        ns.cash-=6;
        ns.stress=clamp(ns.stress+st,0,100);
        // a shot that maxes stress counts as the heart giving out too
        if(ns.stress>=100 || (risk>0 && Math.random()<risk)){
          ns.burnedOut=true;
          ns.endCause="caffeine";
          setS(log(ns,`🚀 Shot #${k}. Liftoff.`,"bad"));
          return;
        }
        ns=checkRepo(ns);
        ns=log(ns,`☕ Shot #${k}. +${e} energy, +${st} stress.`);
        setS(ns);
      };

      // v1.15: pipeline hygiene. Not a funnel motion; once per week.
      const actCrm=()=>{
        if(s.used && s.used.crm)return;
        let[ns,ok]=cost(s,{energy:15,slots:1});
        if(!ok)return;
        ns.used.crm=true;
        const dead=d=>d.stage<=1 && (d.mood==="skeptical" || d.age>=5);
        const pruned=ns.deals.filter(dead).length;
        ns.deals=ns.deals.filter(d=>!dead(d));
        const gain=Math.min(10,5+pruned);
        // "Close that out" reads the manager's mood before the cleanup lands
        const nukeChance=s.manager<40?0.25:0.15;
        ns.manager=clamp(ns.manager+gain,0,100);
        ns.hygieneShield=true;
        let nuked=null;
        const pool=ns.deals.filter(d=>d.stage===1||d.stage===2);
        if(pool.length && Math.random()<nukeChance){
          const warm=d=>(d.mood==="happy"||d.mood==="curious")?1:0;
          nuked=[...pool].sort((a,b)=>warm(b)-warm(a)||b.value-a.value)[0];
          ns.deals=ns.deals.filter(d=>d.id!==nuked.id);
        }
        ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
        ns=log(ns,pruned>0
          ? `🧹 CRM cleanup. -${pruned} dead lead(s), +${gain} manager.`
          : `🧹 CRM cleanup. Nothing dead. +${gain} manager.`);
        if(nuked)ns=log(ns,`🗑️ “Close that out.” ${nuked.account} gone. -${money(nuked.value)}.`,"bad");
        setS(ns);
      };

      const actPolitics=()=>{
        // Internal politics costs more energy now.
        let[ns,ok]=cost(s,{energy:20,slots:1});
        if(!ok)return;
        ns.manager=clamp(ns.manager+8,0,100);
        ns.product=clamp(ns.product+3,0,100);
        ns.reputation=clamp(ns.reputation-4,0,100);
        ns.stress=clamp(ns.stress+2,0,100);
        ns=log(ns,"🏛️ Politics: +8 manager, +3 product, -4 rep.");
        setS(ns);
      };

      const actConference=()=>{
        let[ns,ok]=cost(s,{energy:40,slots:2});
        if(!ok)return;
        ns.cash-=800;
        const n=randi(3,8);
        const adds=Array.from({length:n},()=>makeDeal(s,{warm:true,big:Math.random()<0.4}));
        ns.deals=[...adds,...ns.deals];
        ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
        ns.stress=clamp(ns.stress+5,0,100);
        if(Math.random()<0.30){
          ns.modifiers={
            conversion:(ns.modifiers.conversion||0)+0.08,
            discount:ns.modifiers.discount||0,
            expiresIn:Math.max(1,ns.modifiers.expiresIn||0)
          };
        }
        ns=checkRepo(ns);
        ns=log(ns,`🏟️ Conference: +${n} leads. -40 energy, -$800.`);
        setS(ns);
      };

      const disabled=(needEnergy,needSlots,usedKey)=>(
        s.energy<needEnergy || s.slots<needSlots || s.fired || s.burnedOut || s.win || s.missed || s.repo ||
        !!(usedKey && s.used && s.used[usedKey])
      );
      const shotsNow=s.coffeesThisWeek||0;
      // actCoffee also kills when the shot itself takes stress to 100 (cost() leaves stress alone), so show that as 100%
      const shotLethal=(s.stress||0)+coffeeStress(shotsNow)>=100;
      const nextShotRisk=shotLethal?1:coffeeRisk(shotsNow);
      const crmDone=!!(s.used && s.used.crm);

      return(
        <div className="actions">
          <button className="btn" disabled={disabled(30,1)} onClick={actProspect}>
            <div className="title">📞 Prospect Blitz</div>
            <div className="desc">Find new leads. Cost: 30 Energy • 1 Slot</div>
          </button>
          <button className="btn" disabled={disabled(18,1)} onClick={actCadence}>
            <div className="title">✉️ Email Cadence</div>
            <div className="desc">Warm replies and meetings. Cost: 18 Energy • 1 Slot</div>
          </button>
          <button className="btn" disabled={disabled(22,1)} onClick={actDiscovery}>
            <div className="title">🔎 Discovery Deep Dive</div>
            <div className="desc">Qualify top of funnel. Cost: 22 Energy • 1 Slot</div>
          </button>
          <button className="btn" disabled={disabled(28,1)} onClick={actDemo}>
            <div className="title">🖥️ Demo Marathon</div>
            <div className="desc">Run demos. Cost: 28 Energy • 1 Slot</div>
          </button>
          <button className="btn" disabled={disabled(25,1)} onClick={actPropose}>
            <div className="title">📑 Proposals & Commit</div>
            <div className="desc">Move deals to paper. Cost: 25 Energy • 1 Slot</div>
          </button>
          <button className="btn" disabled={disabled(28,1)} onClick={actClose}>
            <div className="title">🤝 Close Deals</div>
            <div className="desc">Push late-stage opps over the line. Cost: 28 Energy • 1 Slot</div>
          </button>
          <button className="btn" disabled={disabled(16,1)} onClick={actNetwork}>
            <div className="title">🧑‍🤝‍🧑 Referrals & Social</div>
            <div className="desc">High variance: mostly small, sometimes massive. Cost: 16 Energy • 1 Slot</div>
          </button>
          <button className="btn" disabled={disabled(40,2)} onClick={actConference}>
            <div className="title">🏟️ Conference Run</div>
            <div className="desc">Big swing, big leads. Cost: 40 Energy • 2 Slots • $800</div>
          </button>
          <button className="btn" disabled={disabled(0,1)} onClick={actRecharge}>
            <div className="title">🧘 Recharge</div>
            <div className="desc">Once per week. Cost: 1 Slot • Energy +{RECHARGE_ENERGY}–{rechargeMax(RECHARGE_ENERGY)} • Stress -{rechargeRelief(shotsNow)}{rechargeMax(rechargeRelief(shotsNow))>rechargeRelief(shotsNow) ? `–${rechargeMax(rechargeRelief(shotsNow))}` : ""}</div>
          </button>
          <button className="btn" disabled={disabled(0,1)} onClick={actCoffee}>
            <div className="title">☕ Quad Shot</div>
            <div className="desc">Borrow from tomorrow. Cost: 1 Slot • $6 • Stress +{coffeeStress(shotsNow)} (+{CRASH_PER_SHOT} Fri){nextShotRisk>0 ? ` • 🫀 ${pct(nextShotRisk)}%` : ""}</div>
          </button>
          <button className="btn" disabled={disabled(20,1)} onClick={actPolitics}>
            <div className="title">🏛️ Internal Politics</div>
            <div className="desc">Buff manager, tax reputation. Cost: 20 Energy • 1 Slot</div>
          </button>
          <button className="btn" disabled={disabled(15,1,"crm")} onClick={actCrm} title={crmDone ? "Once per week. Back next week." : undefined}>
            <div className="title">🧹 CRM Cleanup</div>
            <div className="desc">{crmDone ? "Done this week. Back next week." : "Weekly. Prune dead leads, +manager. Risky. Cost: 15 Energy • 1 Slot"}</div>
          </button>
        </div>
      );
    };

    // ---------- v1.20: clAInk UI (ad, agent workspace, end cards) ----------
    // The ad pops up at run start; × turns clAInk off for the run. Activating swaps it for the agent workspace, which
    // minimizes to a pill and drags anywhere. Position and minimized state are a UI preference, not run state.
    const CLAINK_UI_KEY="tst-claink-ui";
    const readClainkUi=()=>{
      try{
        const v=JSON.parse(localStorage.getItem(CLAINK_UI_KEY)||"null");
        // adMini is null until you minimize or expand the ad yourself (moving the console doesn't decide it for you)
        if(v && typeof v==="object") return {x:Number.isFinite(v.x)?v.x:null, y:Number.isFinite(v.y)?v.y:null, mini:!!v.mini, adMini:typeof v.adMini==="boolean"?v.adMini:null, chosen:true};
      }catch{}
      return {x:null,y:null,mini:false,adMini:null,chosen:false};
    };
    // until you choose, a short screen (landscape phone) gets the pills so neither the console nor the ad sits on End Week
    const isShortScreen=()=>typeof window!=="undefined" && window.innerHeight>0 && window.innerHeight<=600;
    const clainkUiFor=(u,short)=>({...(u.chosen ? u : {...u,mini:short}), adMini:u.adMini===null ? short : u.adMini});
    // safe-area insets (the page uses viewport-fit=cover), read once from a probe element
    let clainkInsets=null;
    const safeInsets=()=>{
      if(clainkInsets)return clainkInsets;
      const z={t:0,r:0,b:0,l:0};
      try{
        const p=document.createElement("div");
        p.style.cssText="position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
        document.body.appendChild(p);
        const cs=window.getComputedStyle(p);
        clainkInsets={t:parseFloat(cs.paddingTop)||0,r:parseFloat(cs.paddingRight)||0,b:parseFloat(cs.paddingBottom)||0,l:parseFloat(cs.paddingLeft)||0};
        p.remove();
      }catch(_){ return z; }
      return clainkInsets;
    };
    if(typeof window!=="undefined" && window.addEventListener) window.addEventListener("resize",()=>{ clainkInsets=null; }); // rotation changes them
    const clampToView=(x,y,el)=>{
      const i=safeInsets(), w=el?el.offsetWidth:320, h=el?el.offsetHeight:200;
      const l=8+i.l, t=8+i.t, r=8+i.r, b=8+i.b;
      return {x:Math.round(Math.max(l,Math.min(x,window.innerWidth-w-r))), y:Math.round(Math.max(t,Math.min(y,window.innerHeight-h-b)))};
    };
    // A held Enter/Space auto-repeats. Once a clAInk control has used the key, swallow its repeats page-wide until the key
    // comes back up, wherever focus lands next (End Week, the Writing Lesson dialog, an ending).
    let clainkHeldKey=null;
    const guardHeldKey=(e)=>{
      if(e.repeat || (e.key!=="Enter" && e.key!==" ") || clainkHeldKey)return;
      const key=e.key;
      const block=ev=>{ if(ev.repeat && (ev.key==="Enter" || ev.key===" ")){ ev.preventDefault(); ev.stopPropagation(); } };
      const release=ev=>{ if(ev.key!==key)return; document.removeEventListener("keydown",block,true); document.removeEventListener("keyup",release,true); clainkHeldKey=null; };
      document.addEventListener("keydown",block,true);
      document.addEventListener("keyup",release,true);
      clainkHeldKey=block;
    };
    const swallowRepeat=(e)=>{ if(e.repeat && (e.key==="Enter" || e.key===" ")){ e.preventDefault(); return true; } guardHeldKey(e); return false; };
    // A pointer close/minimize makes its control vanish (or move); the rest of that double/triple click or tap must not land on
    // the game button underneath. Only clicks of the same burst, near the same spot, are swallowed (each extends the burst);
    // keyboard clicks and deliberate clicks elsewhere pass. UI-only timer: it never touches game state.
    const shieldNextClick=(e)=>{
      if(!e || e.detail===0)return;
      const x0=e.clientX, y0=e.clientY;
      let t=0;
      const off=()=>{ document.removeEventListener("click",swallow,true); clearTimeout(t); };
      const arm=()=>{ clearTimeout(t); t=setTimeout(off,600); };
      const swallow=ev=>{
        if(ev.detail===0 || Math.abs(ev.clientX-x0)>40 || Math.abs(ev.clientY-y0)>40)return;
        ev.preventDefault(); ev.stopPropagation(); arm();
      };
      document.addEventListener("click",swallow,true);
      arm();
    };
    // keyboard-activated close: send focus somewhere useful instead of <body> (held-key repeats are already swallowed)
    const focusEndWeek=(e)=>{ if(e && e.detail===0){ const b=document.querySelector(".footer .btn.primary"); if(b) try{ b.focus(); }catch(_){} } else shieldNextClick(e); };

    let clainkMarkSeq=0;
    const ClainkMark=({size=24})=>{
      const id=useRef(null);
      if(id.current===null) id.current="clkg"+(++clainkMarkSeq);
      return(
        <svg className="claink-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id={id.current} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#a78bfa"/><stop offset=".55" stopColor="#22d3ee"/><stop offset="1" stopColor="#f472b6"/>
            </linearGradient>
          </defs>
          <rect x="1.5" y="1.5" width="29" height="29" rx="9.5" fill={`url(#${id.current})`}/>
          <path d="M16 5.5 18.4 13.6 26.5 16 18.4 18.4 16 26.5 13.6 18.4 5.5 16 13.6 13.6Z" fill="#0c0a22"/>
          <circle cx="23.6" cy="8.4" r="1.7" fill="#0c0a22"/>
        </svg>
      );
    };
    const ClainkLogo=({small})=>(
      <span className={"claink-logo"+(small?" sm":"")} role="img" aria-label="clAInk Enterprise">
        <ClainkMark size={small?18:30}/>
        <span className="claink-word" aria-hidden="true">cl<b>AI</b>nk</span>
        <span className="claink-tier" aria-hidden="true">ENTERPRISE</span>
      </span>
    );

    // v1.21: the ad minimizes to a pill (the – button, or Esc) and expands again from it; × still turns clAInk off for the
    // run. Minimized is a UI preference like the workspace's (it survives a reload, and a new run expands the ad again).
    const ClainkAd=({s,mini,onToggle,onInstall,onDismiss})=>{
      const ref=useRef(null), ctaRef=useRef(null), notNowRef=useRef(null), toggleRef=useRef(null);
      const[step,setStep]=useState(0); // 0: CTA, 1: the AI use policy + confirm
      const focusNext=useRef(null);
      const policyIdRef=useRef(null);
      if(policyIdRef.current===null) policyIdRef.current="claink-policy-"+(++clainkMarkSeq);
      const policyId=policyIdRef.current, bodyId=policyId+"-body";
      const can=clainkCanInstall(s);
      const declined=!isRunOver(s) && s.cash-CLAINK.INSTALL<=CLAINK.REPO_AT;
      const lastWeek=getQuarterInfo(s.week).weekInQuarter>=CLAINK.OFFER_LAST_WEEK;
      const ends=lastWeek ? "Pilot pricing ends this week" : `Pilot pricing ends Week ${CLAINK.OFFER_LAST_WEEK}`;
      // focus follows the control that replaced the one you used (never back to <body>)
      useEffect(()=>{
        const k=focusNext.current; focusNext.current=null;
        const el=k==="notnow" ? notNowRef.current : k==="cta" ? ctaRef.current : k==="toggle" ? toggleRef.current : null;
        if(el) try{ el.focus({preventScroll:true}); }catch(_){}
      });
      // the ad is bottom-anchored: reserve that much page under it so End Week, deals and the log always scroll clear
      // (on a desktop display the page doesn't scroll; the activity log scrolls clear of it instead, see the CSS)
      useEffect(()=>{
        const el=ref.current, root=document.documentElement;
        if(!el)return;
        const set=()=>{ const b=parseFloat(window.getComputedStyle(el).bottom)||16; root.style.setProperty("--claink-h",Math.ceil(el.offsetHeight+b+8)+"px"); };
        set();
        let ro=null;
        if(typeof ResizeObserver!=="undefined"){ ro=new ResizeObserver(set); ro.observe(el); }
        window.addEventListener("resize",set);
        return()=>{ if(ro)ro.disconnect(); window.removeEventListener("resize",set); root.style.removeProperty("--claink-h"); };
      },[]);
      const toggle=(e)=>{ focusNext.current="toggle"; onToggle(); shieldNextClick(e); }; // the toggle moves out from under the pointer
      const onKeyDown=e=>{
        if(swallowRepeat(e))return;
        if(e.key!=="Escape")return;
        if(e.repeat){ e.preventDefault(); return; }
        if(step===1){ e.preventDefault(); focusNext.current="cta"; setStep(0); }
        else if(!mini){ e.preventDefault(); toggle(e); }
      };
      return(
        <aside ref={ref} className={"claink-ad"+(mini?" is-mini":"")+(step===1 && !mini?" confirming":"")} aria-label={"Sponsored: clAInk Enterprise"+(mini?" (minimized)":"")} onKeyDown={onKeyDown}>
          <div className="claink-ad-top">
            {mini
              ? <span className="claink-ad-pill"><ClainkMark size={16}/><span className="claink-word" aria-hidden="true">cl<b>AI</b>nk</span><span className="sr-only">clAInk. </span><span className="ends">{ends}</span></span>
              : <span className="claink-sponsored">Sponsored · Enterprise pilot</span>}
            <span className="claink-ad-btns">
              <button type="button" ref={toggleRef} className="claink-ad-min" aria-expanded={!mini} aria-controls={bodyId}
                aria-label={mini ? "Expand clAInk ad" : "Minimize clAInk ad"} title={mini ? "Expand" : "Minimize"}
                onClick={toggle}><span aria-hidden="true">{mini ? "▢" : "–"}</span></button>
              <button type="button" className="claink-ad-close" aria-label="Close ad. clAInk will be off for this run"
                title="Close (turns clAInk off for this run)" onClick={onDismiss}><span aria-hidden="true">×</span></button>
            </span>
          </div>
          <div className="claink-ad-body" id={bodyId} hidden={mini}>
            <div className="claink-announce"><span aria-hidden="true">✦</span><span>New: <b>Autonomous Pipeline</b> is GA</span><span aria-hidden="true">→</span></div>
            <ClainkLogo/>
            <h3 className="claink-headline">Your reps sell. Our agents do everything else.</h3>
            <p className="claink-sub">Up to 70% of a rep's week is busywork. clAInk runs a team of autonomous agents that research accounts, write the outreach and advance your deals, around the clock.</p>
            <div className="claink-chips"><span>Account research</span><span>Outreach at scale</span><span>Deal advancement</span></div>
            <p className="claink-proof">“Our agents completed 1.2 million tasks last quarter.”<span>VP of RevOps, Fortune 500 logistics company</span></p>
            <div className="claink-price"><b>Outcome-based pricing.</b> Pay for every outcome, plus the tokens it took to get there.</div>
            <div className="claink-badges"><span>SOC 2 Type II</span><span>SSO</span><span>Human-in-the-loop (optional)</span><span className="urgent"><span aria-hidden="true">⏳ </span>{ends}</span></div>
            <div className="claink-actions">
              {step===0
                ? <button type="button" ref={ctaRef} className="claink-cta" disabled={!can}
                    onClick={()=>{ focusNext.current="notnow"; setStep(1); }}>{declined ? "Declined · cash too low" : `Activate seat · ${money(CLAINK.INSTALL)}`}</button>
                : <>
                    <div className="claink-policy" id={policyId} role="group" aria-labelledby={policyId+"-hd"}>
                      <div className="hd" id={policyId+"-hd"}>Shitcorp AI Use Policy <span>v3 (final) (2)</span></div>
                      <ul>
                        <li>The seat, the tokens and every “outcome” come out of your commission.</li>
                        <li>A run that closes $0 earns a strike from the AI Governance Council.</li>
                        <li>Strike {CLAINK.STRIKES}: seat revoked, plus the token true-up.</li>
                      </ul>
                    </div>
                    <div className="claink-confirm-row">
                      <button type="button" className="claink-confirm" disabled={!can} onClick={onInstall} aria-describedby={policyId}>Accept · {money(CLAINK.INSTALL)}</button>
                      <button type="button" ref={notNowRef} className="claink-notnow" onClick={()=>{ focusNext.current="cta"; setStep(0); }} aria-describedby={policyId}>Not now</button>
                    </div>
                  </>}
            </div>
            <p className="claink-fine">Charged back to you under the Shitcorp AI Use Policy. Usage is invoiced Fridays.
              Pilot results: 1 in 5 agent runs closed real revenue. The other 4 delivered outcomes. Offer ends after Week {CLAINK.OFFER_LAST_WEEK}.</p>
          </div>
        </aside>
      );
    };

    // Three boxes, filled by Shitcorp's AI Governance Council. The note under them says what the next strike costs.
    // At two strikes it works out where the true-up leaves you: max(the run's usage, all your cash + $200-1,800), so a
    // player already in the red lands at cash minus the run's usage, which can be Collections outright.
    const ckTrueUpRange=(cash,due)=>{
      const lo=CLAINK.RETAINER+CLAINK.OUTCOMES[0]*CLAINK.PER_OUTCOME[0], hi=CLAINK.RETAINER+CLAINK.OUTCOMES[1]*CLAINK.PER_OUTCOME[1];
      return [Math.min(-CLAINK.TRUEUP_OVER[0],cash-(due+lo)), Math.min(-CLAINK.TRUEUP_OVER[1],cash-(due+hi))];
    };
    const ClainkStrikes=({n,log,cash,due,ran})=>{
      const S=CLAINK.STRIKES, hot=n>=S-1;
      let note;
      if(!hot) note=n===0 ? `Every run that closes $0 is a strike. ${S} and the seat is revoked.`
        : `${n} down. Strike ${S} revokes the seat and runs the token true-up.`;
      else{
        // after this week's run the next one waits for Friday's bill and payday, so only the usual range holds
        const [best,worst]=ran ? [-CLAINK.TRUEUP_OVER[0],-CLAINK.TRUEUP_OVER[1]] : ckTrueUpRange(cash,due);
        const head=`Next $0 run is strike ${S}: seat revoked, a deal walks, and the token true-up `;
        note=!ran && best<=CLAINK.REPO_AT ? head+"sends you to Collections."
          : head+`leaves you around ${money(best)} to ${money(worst)}${ran?", worse if you're in the red":""}. Collections comes at ${money(CLAINK.REPO_AT)}.`;
      }
      return(
        <div className={"claink-strikes"+(hot?" hot":"")}>
          <div className="row1">
            <span className="lbl">Strikes</span>
            <span className="boxes" role="img" aria-label={`${n} of ${S} strikes`}>
              {Array.from({length:S},(_,i)=>{
                const on=i<n, e=log.find(x=>x.n===i+1);
                const tip=on ? (e ? `Strike ${i+1} · ${e.who}: ${e.line}` : `Strike ${i+1}`) : i+1===S ? `Strike ${S}: seat revoked` : undefined;
                return <span key={i} className={"ck-box"+(on?" on":"")} title={tip}>{on?"✕":i+1}</span>;
              })}
            </span>
            <span className="who">AI Governance Council</span>
          </div>
          <div className={"note"+(hot?" warn":"")}>{note}</div>
        </div>
      );
    };

    const ClainkStrikeCard=({st})=>(
      <div className={"claink-strike ck-beat"+(st.n>=CLAINK.STRIKES?" out":"")}>
        <div className="hd">Strike {st.n} of {CLAINK.STRIKES}{st.who && <span> · filed by {st.who}</span>}</div>
        <p>{st.why}</p>
        {st.fx && <div className="fx">{st.fx}</div>}
      </div>
    );

    // The run report. beat 0 is "agents working" (tokens ticking up); each beat after that lands one more piece:
    // the report lines one by one, the net line, then the strike (or the all-clear). 99 = everything.
    const ClainkReport=({last,beat,workTok,onSkip})=>{
      const k=last.kind, all=beat>=99, nL=last.lines.length;
      if(k==="onboarded") return(
        <div className="claink-report onboarded">
          <div className="hd"><span>Welcome aboard</span></div>
          <ul>{last.lines.map((l,i)=><li key={i}>{l}</li>)}</ul>
        </div>
      );
      if(!all && beat<=0) return(
        <div className="claink-report working" onClick={onSkip||undefined} title="Click or press Esc to skip">
          <span aria-hidden="true">◌ </span>Agents working… <b>{fmtTok(workTok)}</b> tokens
        </div>
      );
      const miracle=k==="miracle", shown=all ? nL : Math.min(nL,beat);
      const net=all || beat>nL, card=all || beat>nL+1;
      return(<>
        {nL>0 && <div className={"claink-report "+(miracle?"miracle":"strike")+(onSkip?" revealing":"")} onClick={onSkip||undefined} title={onSkip?"Click or press Esc to skip":undefined}>
          <div className="hd"><span>{miracle ? <><span aria-hidden="true">✨ </span>It actually worked</> : last.run ? `Run ${last.run} · outcomes delivered` : "Outcomes delivered"}</span>
            {last.tokens>0 && <span className="tok">{fmtTok(last.tokens)} tokens</span>}</div>
          <ul>{last.lines.slice(0,shown).map((l,i)=><li key={i} className={"ck-beat"+(/^\d+ more outcome/.test(l)?" more":"")}>{l}</li>)}</ul>
          {net && <div className={"net ck-beat"+(miracle?"":" zero")}>{miracle ? `Closed +${money(last.revenue)} · verified by Finance` : "Closed: $0"}</div>}
        </div>}
        {card && (last.strike ? <ClainkStrikeCard st={last.strike}/> : miracle && last.clear ? <div className="claink-clear ck-beat">{last.clear}</div> : null)}
      </>);
    };

    // the seat's obituary: the three strikes as filed, and what the pilot cost
    const ClainkRevoked=({c})=>(
      <div className="claink-revoked ck-beat">
        <div className="stamp" aria-hidden="true">REVOKED</div>
        <p>The AI Governance Council has sunset your agents. They will be missed by no one.</p>
        {c.last && c.last.farewell && <p className="farewell">Its farewell email to {c.last.farewell}: “It's not you, it's me.” They agreed.</p>}
        {c.strikeLog.length>0 && <ol className="claink-recap">{c.strikeLog.map((e,i)=>(
          <li key={`${e.n}-${i}`}><span className="num" aria-hidden="true">{e.n}</span><span className="sr-only">Strike {e.n}: </span><b>{e.who}</b> · {e.line}</li>
        ))}</ol>}
        <p className="claink-stats">{fmtTok(c.tokens)} tokens · Influenced {money(c.claimed)} · Closed {money(c.delivered)} · Charged back {money(c.billed)}</p>
      </div>
    );

    const CK_WORK_MS=650, CK_BEAT_MS=280;

    const ClainkConsole=({s,ui,setUi,focusOnMount,onDeploy,onCancel,onHide,onRevealDone})=>{
      const c=s.claink;
      const end=c.status!=="active";
      const mini=!!ui.mini && !end;
      const ref=useRef(null), statusRef=useRef(null), toggleRef=useRef(null), cancelRef=useRef(null), keepRef=useRef(null);
      // pos = where you put it (saved); shown = where it fits on this screen right now (never saved, so a rotation or a
      // short-lived resize doesn't lose your spot)
      const[pos,setPos]=useState(()=>Number.isFinite(ui.x) && Number.isFinite(ui.y) ? {x:ui.x,y:ui.y} : null);
      const[shown,setShown]=useState(null);
      const[confirmCancel,setConfirmCancel]=useState(false);
      const[dragging,setDragging]=useState(false);
      const drag=useRef(null);
      const focusNext=useRef(focusOnMount ? "status" : null);
      const bodyIdRef=useRef(null);
      if(bodyIdRef.current===null) bodyIdRef.current="claink-body-"+(++clainkMarkSeq);
      const bodyId=bodyIdRef.current;
      // v1.20: a run plays out beat by beat (tokens tick up, outcomes land one at a time, then the strike lands), so a run
      // reads as a short story instead of a wall of text, and each beat is voiced as it lands (the activity log leaves these
      // lines to the workspace). Only a run you just started plays: a reload, a minimized workspace or reduced motion gets
      // the whole report, and one cue, at once. Click the report or press Esc to skip. onRevealDone hands over the Writing
      // Lesson (if the manager took a deal) once the report has had its say.
      const[beat,setBeat]=useState(99);
      const[workTok,setWorkTok]=useState(0);
      const seenRun=useRef(c.deploys);
      const reveal=useRef({timers:[],live:false});
      const holdH=useRef(0); // the window keeps its height while a report replays, so nothing moves under the pointer
      const doneRef=useRef(onRevealDone); doneRef.current=onRevealDone;
      const liveS=useRef(s); liveS.current=s;
      const handOver=()=>{ const r=reveal.current; if(r.live){ r.live=false; if(doneRef.current) doneRef.current(); } };
      const finishReveal=()=>{
        const r=reveal.current;
        r.timers.forEach(clearTimeout); r.timers=[];
        holdH.current=0;
        setBeat(99);
        handOver();
      };
      // one beat's sound and PA line; silent once an ending is playing its own score
      const cue=(sound,pa)=>{
        if(isRunOver(liveS.current))return;
        const a=AUDIO(); if(!a)return;
        if(sound) a.play(sound);
        if(pa) a.say(pa,{cooldown:4000});
      };
      // a layout effect, so the finished report never paints ahead of "Agents working…"
      (React.useLayoutEffect||useEffect)(()=>{
        if(c.deploys===seenRun.current)return;
        seenRun.current=c.deploys;
        const r=reveal.current, L=c.last;
        r.timers.forEach(clearTimeout); r.timers=[]; r.live=true;
        const isRun=!!L && (L.kind==="miracle" || L.kind==="strike" || L.kind==="revoked");
        if(!isRun){ setBeat(99); r.timers.push(setTimeout(finishReveal,0)); return; }
        const out=L.kind==="revoked", win=L.kind==="miracle", hurt=!!(L.strike && L.strike.hurt);
        // one PA line per run: HR offboarding the agent, else the manager (the warning and a yoink speak when their dialog
        // opens), else the result
        const managerPa=L.ping && !L.yoink && !L.warn && !out ? "chatgdp" : null;
        const resultPa=out ? "clainkRevoked" : L.ping ? null : win ? "claink" : hurt ? "sev1" : "strike";
        const hit=out ? "bsod" : win ? "cash" : hurt ? "glitch" : "stamp";
        // nothing to watch: hand over right after this commit (so the page's own effects have seen the new state)
        if(reducedNow() || mini){ setBeat(99); cue(hit,resultPa||managerPa); if(L.cashWarn) cue("alarm"); r.timers.push(setTimeout(finishReveal,0)); return; }
        const nL=L.lines.length, beats=nL+2+(L.ping?1:0)+(out?1:0), tok=L.tokens||0;
        const at=b=>CK_WORK_MS+(b-1)*CK_BEAT_MS, later=(ms,fn)=>r.timers.push(setTimeout(fn,ms));
        setBeat(0); setWorkTok(Math.round(tok*0.06)); cue("beep");
        for(let i=1;i<6;i++) later(i*CK_WORK_MS/6,()=>setWorkTok(Math.round(tok*Math.min(1,0.06+i*0.19))));
        for(let b=1;b<=beats;b++) later(at(b),()=>setBeat(b));
        // the cues ride the same beats: a tick per outcome, the net, the strike (or the all-clear), the manager, the farewell
        for(let b=1;b<=nL;b++) later(at(b),()=>cue(b===1 && win ? "sparkle" : "tick"));
        later(at(nL+1),()=>cue(win ? "cash" : "thud"));
        later(at(nL+2),()=>{ cue(win ? null : hit,resultPa); if(L.cashWarn) cue("alarm"); });
        if(L.ping) later(at(nL+3),()=>cue(L.yoink ? "lost" : "suspicion",managerPa));
        if(out && L.farewell) later(at(beats),()=>cue("lost"));
        later(CK_WORK_MS+beats*CK_BEAT_MS,finishReveal);
      },[c.deploys]);
      // closed mid-report (the end card's × finishes it first; an unmount here means New Game or Load, and the page drops it)
      useEffect(()=>()=>{ const r=reveal.current; r.timers.forEach(clearTimeout); r.timers=[]; handOver(); },[]);
      const place=p=>{ setPos(p); setShown(p); setUi(u=>({...u,x:p.x,y:p.y,mini})); }; // user moves only; keeps what you see (pill or console)
      const fit=()=>{
        const el=ref.current;
        if(!el || !pos || drag.current)return;
        const p=clampToView(pos.x,pos.y,el);
        if(!shown || p.x!==shown.x || p.y!==shown.y) setShown(p);
      };
      // focus follows the control that replaced the one you used (never back to <body>)
      useEffect(()=>{
        const k=focusNext.current; focusNext.current=null;
        const el=k==="status" ? (mini ? toggleRef.current : statusRef.current) : k==="toggle" ? toggleRef.current : k==="cancel" ? cancelRef.current : k==="keep" ? keepRef.current : null;
        if(el) try{ el.focus({preventScroll:true}); }catch(_){}
      });
      // fit before paint after every render, so content that just grew (cancel confirm, a report line) never flashes off-screen
      (React.useLayoutEffect||useEffect)(fit);
      // ...and on size changes React didn't cause (fonts loading) and window resizes / rotations
      useEffect(()=>{
        const el=ref.current;
        let ro=null;
        if(el && typeof ResizeObserver!=="undefined"){ ro=new ResizeObserver(fit); ro.observe(el); }
        window.addEventListener("resize",fit);
        return()=>{ if(ro)ro.disconnect(); window.removeEventListener("resize",fit); };
      },[pos,shown,mini,end]);
      // a run result also reaches screen readers when a dialog has already made the page inert (an ending that the run
      // caused; the delayed Writing Lesson carries its own copy). Only for results that happen while you're here: a reload
      // must not replay an old one into an ending dialog.
      const heard=useRef(`${c.deploys}|${c.status}`);
      useEffect(()=>{
        const key=`${c.deploys}|${c.status}`;
        if(heard.current===key || !c.last || !c.last.announce)return;
        heard.current=key;
        const t=setTimeout(()=>{ const sr=document.querySelector("dialog[open] .tst-sr"); if(sr){ sr.textContent=""; sr.textContent=c.last.announce; } },120);
        return()=>clearTimeout(t);
      },[c.deploys,c.status]);
      const onPointerDown=e=>{
        if(e.pointerType==="mouse" && e.button!==0)return;
        if(e.target.closest && e.target.closest("button:not(.claink-grip)"))return; // the grip drags too; minimize/close don't
        const el=ref.current; if(!el)return;
        const r=el.getBoundingClientRect();
        drag.current={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top,moved:false};
        try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(_){}
        setDragging(true);
      };
      const onPointerMove=e=>{
        const d=drag.current; if(!d || d.id!==e.pointerId)return;
        d.moved=true;
        const p=clampToView(e.clientX-d.dx,e.clientY-d.dy,ref.current);
        setPos(p); setShown(p);
      };
      const endDrag=e=>{
        const d=drag.current; if(!d || d.id!==e.pointerId)return;
        drag.current=null; setDragging(false);
        const el=ref.current;
        if(d.moved && el){ const r=el.getBoundingClientRect(); place(clampToView(r.left,r.top,el)); }
      };
      const onGripKey=e=>{
        const dir={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
        if(!dir)return;
        e.preventDefault();
        const el=ref.current; if(!el)return;
        const r=el.getBoundingClientRect(), step=e.shiftKey?64:16;
        place(clampToView(r.left+dir[0]*step,r.top+dir[1]*step,el));
      };
      // minimize/expand keeps your parked spot (the console may sit higher only while it needs the room); with no spot yet,
      // the top-left corner you see becomes it, so the pill stays put
      const toggle=(e)=>{
        const el=ref.current;
        let p=pos;
        if(!p && el){ const r=el.getBoundingClientRect(); p={x:Math.round(r.left),y:Math.round(r.top)}; }
        if(p){ setPos(p); setShown(null); }
        setUi(u=>({...u,x:p?p.x:u.x,y:p?p.y:u.y,mini:!mini}));
        focusNext.current="toggle";
        shieldNextClick(e); // the toggle moves out from under the pointer
      };
      const onKeyDown=e=>{
        if(swallowRepeat(e))return;
        if(e.key==="Escape" && e.repeat){ e.preventDefault(); return; }
        if(e.key==="Escape" && beat<99){ e.preventDefault(); finishReveal(); return; }
        if(e.key==="Escape" && !end && !ui.mini){ e.preventDefault(); toggle(); }
      };
      const L=c.last;
      const isRun=!!L && (L.kind==="miracle" || L.kind==="strike" || L.kind==="revoked");
      const nL=L ? L.lines.length : 0, all=beat>=99;
      // the strike box fills when its card lands, not while the agents are still "working"
      const strikeIn=all || beat>nL+1;
      const strikes=c.strikes||0;
      const shownStrikes=(isRun && L.strike && !strikeIn) ? Math.max(0,strikes-1) : strikes;
      const pingIn=all || beat>nL+2;
      const endIn=all || beat>nL+2+(L && L.ping?1:0);
      const cost=clainkCancelCost(s), canCancel=clainkCanCancel(s);
      const frozen=clainkFrozen(s);
      const pill=end ? (c.status==="revoked" ? "Revoked" : "Cancelled") : frozen ? "Frozen" : c.deployed ? "Ran" : "Ready";
      const at=shown||pos;
      const hold=beat<99 && holdH.current && !mini && c.status!=="cancelled" ? Math.min(holdH.current,window.innerHeight-24) : 0;
      const style=at || hold ? {...(at?{left:at.x+"px",top:at.y+"px"}:{}),...(hold?{minHeight:hold+"px"}:{})} : undefined;
      const skip=beat<99 ? finishReveal : null;
      return(
        <aside ref={ref} style={style} onKeyDown={onKeyDown} aria-label="clAInk agent workspace"
          className={"claink-console"+(mini?" is-mini":"")+(end?" is-end":"")+(pos?" is-placed":"")+(dragging?" dragging":"")}>
          <div className="claink-titlebar" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
            <ClainkMark size={16}/>
            <span className="claink-title">clAInk{!mini && <span> Agent Workspace</span>}</span>
            {mini && <span className="claink-pilltext">{pill}{shownStrikes>0 && !end ? ` · ${shownStrikes}/${CLAINK.STRIKES} strikes` : ""}</span>}
            <span className={"claink-dot"+(end ? (endIn?" dead":" busy") : c.deployed?" busy":"")} aria-hidden="true"/>
            <span className="claink-tb-btns">
              <button type="button" className="claink-grip" aria-label="Move clAInk window" title="Drag to move, or use the arrow keys"
                onKeyDown={onGripKey}><span aria-hidden="true">⠿</span></button>
              {!end && <button type="button" ref={toggleRef} className="claink-min" aria-expanded={!mini} aria-controls={bodyId}
                aria-label={mini ? "Expand clAInk workspace" : "Minimize clAInk workspace"} title={mini ? "Expand" : "Minimize"}
                onClick={toggle}><span aria-hidden="true">{mini ? "▢" : "–"}</span></button>}
              {end && <button type="button" className="claink-end-close" aria-label="Close clAInk window" title="Close"
                onClick={e=>{ if(beat<99) finishReveal(); onHide(e); }}><span aria-hidden="true">×</span></button>}
            </span>
          </div>
          <div className="claink-body" id={bodyId} hidden={mini}>
            {c.status==="active" && <>
              <div className="claink-statusline" tabIndex={-1} ref={statusRef}><span aria-hidden="true">● </span>{frozen ? "Quarter-end freeze · no runs" : c.deployed ? "Agents ran this week" : "Agents idle · awaiting delegation"}</div>
              <button type="button" className="claink-deploy" disabled={!clainkCanDeploy(s)}
                onClick={e=>{ focusNext.current="status"; holdH.current=ref.current ? ref.current.offsetHeight : 0; shieldNextClick(e); onDeploy(); }}>
                <span><span aria-hidden="true">{frozen ? "🔒 " : c.deployed ? "✓ " : "▶ "}</span>{frozen ? "Quarter-end freeze" : c.deployed ? "Ran this week" : "Run agents"}</span>
                <small>{frozen ? "no runs in week 13" : c.deployed ? (getQuarterInfo(s.week).weekInQuarter>=QUARTER_WEEKS-1 ? "last run this quarter" : "next run: next week") : "0 energy · 0 slots · billed Fri"}</small>
              </button>
              <ClainkStrikes n={shownStrikes} log={c.strikeLog} cash={s.cash} due={c.due} ran={c.deployed}/>
            </>}
            {c.status==="revoked" && <div className="claink-statusline" tabIndex={-1} ref={statusRef}><span aria-hidden="true">● </span>{endIn ? "Seat revoked" : "Agents running…"}</div>}
            {L && c.status!=="cancelled" && (isRun || L.kind==="onboarded") && <ClainkReport last={L} beat={beat} workTok={workTok} onSkip={skip}/>}
            {L && L.ping && pingIn && <div className="claink-ping ck-beat"><span className="who"><span aria-hidden="true">👔 </span>Your manager</span><span>{L.ping}</span></div>}
            {c.status==="active" && <>
              {(all || !isRun) && <div className="claink-usage">{frozen ? <>Quarter-end freeze: nothing more gets billed · Charged back so far {money(c.billed)}</>
                : c.deployed ? <>This week: <b>{money(c.due)}</b> ({fmtTok(c.weekTokens)} tokens), billed Friday · Charged back so far {money(c.billed)}</>
                : <>Idle weeks still bill {money(CLAINK.IDLE[0])}–{money(CLAINK.IDLE[1])}: background agents keep “thinking” · Charged back so far {money(c.billed)}</>}</div>}
              {frozen ? null : !confirmCancel
                ? <button type="button" ref={cancelRef} className="claink-cancel-link"
                    onClick={()=>{ focusNext.current="keep"; setConfirmCancel(true); }}>Cancel seat</button>
                : <div className="claink-cancel-box" role="group" aria-label="Cancel clAInk seat">
                    <span>Early termination: {money(cost)} ({money(CLAINK.CANCEL)} fee + this week's usage).</span>
                    <span className="offer">Before you go: Enterprise Plus hits 21% success. Just $4,999/wk.</span>
                    <span className="row2">
                      <button type="button" ref={keepRef} className="claink-cancel-keep" onClick={()=>{ focusNext.current="cancel"; setConfirmCancel(false); }}>Keep agents</button>
                      <button type="button" className="claink-cancel-confirm" disabled={!canCancel}
                        onClick={()=>{ focusNext.current="status"; onCancel(); }}>{canCancel ? `Pay ${money(cost)} & cancel` : "Can't afford the fee"}</button>
                    </span>
                  </div>}
            </>}
            {c.status==="revoked" && endIn && <ClainkRevoked c={c}/>}
            {c.status==="cancelled" && <div className="claink-offboarded">
              <div className="claink-statusline" tabIndex={-1} ref={statusRef}>Seat cancelled</div>
              <p>Your data stays with clAInk “to improve the models.” <span aria-hidden="true">💜</span></p>
              <p className="claink-stats">{fmtTok(c.tokens)} tokens · Closed {money(c.delivered)} · Charged back {money(c.billed)}</p>
            </div>}
          </div>
          <div className="claink-live sr-only" aria-live="polite">{c.last && c.last.announce
            ? (isRun ? `Run ${c.deploys}: ${c.last.announce}` : c.last.announce) : ""}</div>
        </aside>
      );
    };

    // picks what clAInk shows: the ad, the workspace, an end card, or nothing (closed ad, expired offer, closed end card)
    const ClainkDock=({s,setS,ui,setUi,onEvent})=>{
      const c=s.claink;
      const prev=useRef(c ? c.status : null);
      const justInstalled=prev.current==="ad" && !!c && c.status==="active";
      useEffect(()=>{ prev.current=c ? c.status : null; });
      const lesson=useRef(null); // the Writing Lesson waits for the run's report to finish
      // New Game / Load remount the dock: React tears a deleted tree down parent first, so this drops a held lesson before
      // the workspace's own cleanup could hand it over into the next run
      useEffect(()=>()=>{ lesson.current=null; },[]);
      if(!c)return null;
      const commit=fn=>setS(p=>checkBurnout(fn(p)));
      if(c.status==="ad"){
        if(isRunOver(s) || getQuarterInfo(s.week).weekInQuarter>CLAINK.OFFER_LAST_WEEK)return null;
        // toggle from what you see, not from the stored preference (a short screen shows the pill before you chose)
        const adMini=!!ui.adMini;
        return <ClainkAd s={s} mini={adMini} onToggle={()=>setUi(u=>({...u,adMini:!adMini}))}
          onInstall={()=>commit(buyClaink)} onDismiss={e=>{ commit(dismissClaink); focusEndWeek(e); }}/>;
      }
      if(c.status==="active" || ((c.status==="cancelled" || c.status==="revoked") && !c.hidden)){
        return <ClainkConsole s={s} ui={ui} setUi={setUi} focusOnMount={justInstalled}
          onDeploy={()=>{
            const r=deployClaink(s), L=r.state.claink && r.state.claink.last;
            lesson.current=r.event ? {...r.event,week:r.state.week,runId:r.state.runId,run:r.state.claink.deploys,announce:(L && L.announce)||""} : null;
            setS(checkBurnout(r.state));
          }}
          onRevealDone={()=>{ const ev=lesson.current; lesson.current=null; if(ev) onEvent(ev); }}
          onCancel={()=>commit(cancelClaink)}
          onHide={e=>{ commit(hideClainkCard); focusEndWeek(e); }}/>;
      }
      return null;
    };

    function Game(){
      const createInitial=()=>{
        const base=newGame();
        try{
          const raw=readStoredRun(true);
          if(!raw)return base;
          return mergeSaved(JSON.parse(raw));
        }catch{ return base; }
      };

      const[s,setS]=useState(createInitial);
      const[pending,setPending]=useState(null);
      const[over,setOver]=useState(null);
      const[asciiSpeed,setAsciiSpeed]=useState(120);
      const[showHelp,setShowHelp]=useState(false);
      const[helpOpens,setHelpOpens]=useState(0); // keys the onboarding memo so its gag replays on each open
      const[claUi,setClaUi]=useState(readClainkUi); // v1.19: clAInk console position + minimized (a UI preference, not run state)
      const[epoch,setEpoch]=useState(0);            // v1.19: New Game, Load and New Run remount clAInk's local UI state
      const setClaUiByYou=fn=>setClaUi(u=>({...(typeof fn==="function"?fn(u):fn),chosen:true})); // only your own moves/toggles are saved
      const[shortScreen,setShortScreen]=useState(isShortScreen); // re-checked on rotation, for the pill default
      useEffect(()=>{ const on=()=>setShortScreen(isShortScreen()); window.addEventListener("resize",on); return()=>window.removeEventListener("resize",on); },[]);
      useEffect(()=>{ if(!claUi.chosen)return; try{ localStorage.setItem(CLAINK_UI_KEY,JSON.stringify({x:claUi.x,y:claUi.y,mini:claUi.mini,adMini:claUi.adMini})); }catch{} },[claUi]);
      const expandAd=()=>setClaUi(u=>u.adMini===null ? u : {...u,adMini:null}); // v1.21: a new run's ad starts fresh (expanded; the pill on a short screen)
      const sceneRef=useRef(null);

      // FIX: header buttons were re-bound on every state change. Bind once; read live state through a ref.
      const sRef=useRef(s);
      (React.useLayoutEffect||useEffect)(()=>{ sRef.current=s; },[s]);

      useEffect(()=>{
        const ng=document.getElementById("new-game");
        const sv=document.getElementById("save");
        const ld=document.getElementById("load");
        const onNew=()=>{
          const a=AUDIO(); if(a){ a.hush(); a.play("newgame"); a.say("newrun",{cooldown:3000}); }
          setS(newGame());
          setEpoch(e=>e+1); // v1.19: fresh clAInk UI state
          expandAd();
          setPending(null);
          setOver(null);
        };
        const onSave=()=>{
          try{
            localStorage.setItem(SAVE_KEY,JSON.stringify(sRef.current));
            sfx("save");
            notify("Run saved.");
          }catch{
            sfx("nope");
            notify("Couldn’t save — storage is blocked in this browser.");
          }
        };
        const onLoad=()=>{
          const v=readStoredRun(false);
          if(!v){
            sfx("nope");
            notify("No save found.");
            return;
          }
          try{
            const a=AUDIO(); if(a){ a.hush(); a.play("load"); }
            setS(mergeSaved(JSON.parse(v)));
            setEpoch(e=>e+1); // v1.19: fresh clAInk UI state
            setPending(null);
            setOver(null);
          }catch{
            notify("Save was corrupted. Starting a new run.");
            setS(newGame());
            setEpoch(e=>e+1); // v1.19: fresh clAInk UI state
            setPending(null);
            setOver(null);
          }
        };
        if(ng)ng.addEventListener("click",onNew);
        if(sv)sv.addEventListener("click",onSave);
        if(ld)ld.addEventListener("click",onLoad);
        return()=>{
          if(ng)ng.removeEventListener("click",onNew);
          if(sv)sv.removeEventListener("click",onSave);
          if(ld)ld.removeEventListener("click",onLoad);
        };
      },[]);

      useEffect(()=>{
        try{
          localStorage.setItem(AUTOSAVE_KEY,JSON.stringify(s));
        }catch{}
      },[s]);

      // v1.14: every new log line maps to a sound (and sometimes a PA line). Reads state only.
      const lastLogRef=useRef(s.logs.length?s.logs[0].id:null);
      useEffect(()=>{
        const prev=lastLogRef.current;
        lastLogRef.current=s.logs.length?s.logs[0].id:null;
        const a=AUDIO(); if(!a)return;
        let fresh;
        if(prev===null){ fresh=s.logs.slice(); }
        else{
          const idx=s.logs.findIndex(e=>e.id===prev);
          if(idx<0)return; // a whole run was swapped in (load / new game)
          fresh=s.logs.slice(0,idx);
        }
        if(fresh.length===0 || fresh.length>40)return;
        a.onLogs(fresh.reverse(),{over:!!(s.fired||s.burnedOut||s.win||s.missed||s.repo)});
      },[s.logs]);
      useEffect(()=>{
        if(!pending || s.fired || s.burnedOut || s.win || s.missed || s.repo)return;
        const a=AUDIO(); if(a) a.onModal(pending.title);
      },[pending]);

      const endWeek=()=>{
        if(s.fired || s.burnedOut || s.win || s.missed || s.repo)return;
        let ns={...s};

        // End-of-week closes still happen with current modifiers.
        if(Math.random()<0.15){
          ns=tryCloseSome(ns,"🕘 Friday closes");
        }

        // Tick down existing modifiers BEFORE we potentially apply new ones during this endWeek().
        ns=tickModifiers(ns);

        ns=salaryAndBills(ns);
        if(isRunOver(ns)){ setPending(null); setS(ns); return; } // v1.19: a rent repo ends the week here, so the ending stays the last line
        ns=randomEvents(ns,setPending,2);
        ns=ageAndGhost(ns);
        ns=checkBurnout(ns);
        // a run that just ended (burnout here, repo from the bills) stops simulating, so its ending stays the last line
        if(isRunOver(ns)){ setPending(null); setS(ns); return; }

        const u=ns.used;
        const didProspectish=u.prospect||u.cadence||u.network;
        const didLate=u.propose||u.close;
        const motionsHit=[
          didProspectish,
          u.discovery,
          u.demo,
          didLate
        ].filter(Boolean).length;
        const motionsSkipped=4-motionsHit;

        if(motionsHit>=3){
          ns.modifiers={
            conversion:(ns.modifiers.conversion||0)+0.06,
            discount:ns.modifiers.discount||0,
            expiresIn:Math.max(1,ns.modifiers.expiresIn||0)
          };
          ns=log(ns,"🧩 Full-funnel week. +6% close next week.");
        }else if(motionsSkipped>=3 && ns.pipeline>0){
          ns.modifiers={
            conversion:(ns.modifiers.conversion||0)-0.06,
            discount:ns.modifiers.discount||0,
            expiresIn:Math.max(1,ns.modifiers.expiresIn||0)
          };
          ns=log(ns,"🪫 Funnel neglected. -6% close next week.","warn");
        }

        if(!u.discovery && countStage(ns.deals,0)>=6){
          let lost=0;
          ns.deals=ns.deals.filter(d=>{
            if(d.stage===0 && Math.random()<0.20){lost++;return false;}
            return true;
          });
          if(lost>0){
            ns=log(ns,`🍂 ${lost} raw lead(s) went stale.`,"warn");
            ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
          }
        }

        if(!u.demo && countStage(ns.deals,1)>=5){
          let reg=0;
          ns.deals=ns.deals.map(d=>{
            if(d.stage===1 && Math.random()<0.18){
              reg++;
              return {...d,stage:0,mood:"skeptical"};
            }
            return d;
          });
          if(reg>0){
            ns=log(ns,`🕑 Demo backlog: ${reg} lead(s) went cold.`,"warn");
            ns.pipeline=ns.deals.reduce((sum,d)=>sum+d.value,0);
          }
        }

        ns.energy=clamp(ns.energy+15,0,100);
        // v1.15: caffeinated weeks crash instead of recovering
        const shots=ns.coffeesThisWeek||0;
        if(shots>0){
          const crash=CRASH_PER_SHOT*shots;
          ns.stress=clamp(ns.stress+crash,0,100);
          ns=log(ns,`🥴 Caffeine crash. +${crash} stress.`,"warn");
        }else{
          ns.stress=clamp(ns.stress-4,0,100);
        }

        // v1.15: burnout lands before reviews. Danger zone rolls every weekend.
        ns=checkBurnout(ns);
        if(!isRunOver(ns) && ns.stress>=STRESS_DANGER && Math.random()<(ns.stress-75)*DANGER_RATE){
          ns.burnedOut=true;
          ns.endCause="stress";
          ns=log(ns,"☢️ Weekend didn’t help. Meltdown.","bad");
        }
        if(isRunOver(ns)){ setPending(null); setS(ns); return; }

        ns=checkRepo(ns);

        const perfToDate=ns.quota>0 ? ns.closedQuarter/ns.quota : 0;
        const drift=(perfToDate-0.5)*4;
        ns.manager=clamp(ns.manager+drift,0,100);

        // Email cadence without calling annoys the manager.
        if(ns.used.cadence && !ns.used.prospect){
          ns.manager=clamp(ns.manager-3,0,100);
          ns=log(ns,"📵 “Nice emails. Now call someone.” -3 manager.","warn");
        }

        const {weekInQuarter}=getQuarterInfo(ns.week);

        // Early termination checks never fire on the final week (week 13); QBR handles that.
        if(weekInQuarter>=5 && weekInQuarter<QUARTER_WEEKS && behindPace(ns, weekInQuarter) && !ns.fired && !ns.burnedOut && !ns.repo && !ns.win && !ns.missed){
          ns=midQuarterRisk(ns, weekInQuarter);
          ns=checkBurnout(ns);
        }

        if(weekInQuarter===QUARTER_WEEKS && !ns.fired && !ns.burnedOut && !ns.repo){
          ns=evaluateQuarter(ns);
        }

        if(ns.fired || ns.burnedOut || ns.win || ns.missed || ns.repo){
          setPending(null); // an event queued this week must not stack on the game-over dialog
          setS(ns);
          return;
        }

        // v1.19: clAInk invoices last, so a fired or finished run is never billed (and a week-13 Club can't turn into a repo)
        ns=billClaink(ns);
        ns=expireClaink(ns);
        if(isRunOver(ns)){ setPending(null); setS(ns); return; }

        const nextWeek=ns.week+1;
        ns=log(ns,`📆 Week ${nextWeek}.`);
        ns.week=nextWeek;
        ns.slots=ns.maxSlots;
        ns.restedThisWeek=false;
        ns.coffeesThisWeek=0;
        ns.stressWarned=false;
        ns.hygieneShield=false;
        ns.used={
          prospect:false,
          cadence:false,
          discovery:false,
          demo:false,
          propose:false,
          close:false,
          network:false,
          recharge:false,
          crm:false
        };

        setS(ns);
      };

      useEffect(()=>{
        if(s.fired || s.burnedOut || s.win || s.missed || s.repo){
          const type=
            s.repo ? "repo" :
            s.burnedOut ? "burnout" :
            s.win ? "club" :
            s.missed ? "missed" :
            "fired";
          // v1.15: endCause is set wherever an ending lands; log parsing is only for pre-v1.15 saves
          const legacyCause=()=>{
            if(type!=="fired")return type==="burnout" ? "stress" : type;
            const lastBad=s.logs.find(e=>e.kind==="bad");
            return !lastBad ? "qbr" : lastBad.msg.indexOf("🪓")===0 ? "org" : lastBad.msg.indexOf("📉 Mid-quarter")===0 ? "review" : "qbr";
          };
          const cause=s.endCause || legacyCause();
          const title=
            type==="club" ? "President’s Club ✨" :
            type==="burnout" ? (cause==="caffeine" ? "Ascension 🚀" : "Meltdown ☢️") :
            type==="missed" ? "Barely Missed 😮‍💨" :
            type==="repo" ? "Jacket Repo’d 🧥" :
            "Terminated 💼";
          const body=
            type==="club"
              ? `Closed ${money(s.closedWon)}. Pack for Cabo.`
              : type==="burnout"
                ? (cause==="caffeine"
                  ? `Closed ${money(s.closedWon)}. Then you went orbital.`
                  : `Closed ${money(s.closedWon)}. Core breached.`)
                : type==="missed"
                  ? `Closed ${money(s.closedWon)}. Badge kept. Back to the phones.`
                  : type==="repo"
                    ? (cause==="claink" ? `Cash hit ${money(s.cash)}. clAInk sent you to Collections.` : `Cash hit ${money(s.cash)}. The loan came due.`)
                    : `Closed ${money(s.closedWon)}. Your Slack is already gone.`;
          const meta={pct:s.quota>0 ? s.closedWon/s.quota : 0, cause, shots:s.coffeesThisWeek||0};
          setPending(null);
          setOver({title,body,type,meta});
        }else{
          setOver(null);
        }
      },[s.fired,s.burnedOut,s.win,s.missed,s.repo,s.closedWon]);

      // v1.14: heartbeat under the music when stress runs hot
      useEffect(()=>{ const a=AUDIO(); if(a) a.setStress(over ? 0 : s.stress); },[s.stress,over]);

      const {weekInQuarter}=getQuarterInfo(s.week);
      const hasLateDeal = s.deals.some(d=>d.stage>=3);
      const pacePercent=pct(weekInQuarter/QUARTER_WEEKS);
      // v1.15: the caffeine crash lands inside End Week, right before the danger roll, so label stress by where it will be
      const crashDue=CRASH_PER_SHOT*(s.coffeesThisWeek||0);
      const projStress=Math.min(100,s.stress+crashDue);
      const stressZone=projStress>=STRESS_DANGER ? "Danger zone" : projStress>=60 ? "Edgy" : "";
      const stressSub=(stressZone||crashDue)
        ? <span style={{color:projStress>=STRESS_DANGER?"var(--bad)":"var(--warn)"}}>{[stressZone,crashDue?(stressZone?`+${crashDue} Fri`:`Crash +${crashDue} Fri`):""].filter(Boolean).join(" • ")}</span>
        : null;

      const tryOpportunisticClose=()=>{
        if(!hasLateDeal){
          setS(log(s,"🧪 No late-stage deals to Hail-Mary.","warn"));
          return;
        }
        let[ns,ok]=cost(s,{energy:10,slots:1});
        if(!ok)return;
        const miracle=Math.random()<0.2;
        const beforeClosed=ns.closedWon;

        ns=log(
          ns,
          miracle
            ? "🧪 Hail-Mary: “last chance” blast to every exec."
            : "🧪 Hail-Mary: leaning on every late deal. Hard.",
          "warn"
        );
        let st=tryCloseSome(ns,"🧪 Hail-Mary");
        const closedDelta=st.closedWon-beforeClosed;

        if(miracle){
          if(closedDelta>0){
            st.manager=clamp(st.manager+8,0,100);
            st.stress=clamp(st.stress+4,0,100);
            st=log(st,"🌪️ Chaos worked. +8 manager, +4 stress.");
          }else{
            st.manager=clamp(st.manager-4,0,100);
            st.stress=clamp(st.stress+6,0,100);
            st=log(st,"🤕 All noise, no ink. -4 manager, +6 stress.","bad");
          }
        }else{
          st=killDeals(st,d=>d.stage>=3,0.55);
          st.manager=clamp(st.manager-8,0,100);
          st.stress=clamp(st.stress+8,0,100);
          st.reputation=clamp(st.reputation-4,0,100);
          if(closedDelta<=0){
            st=log(st,"📛 Pipe torched. -8 manager, -4 rep, +8 stress.","bad");
          }else{
            st.manager=clamp(st.manager+2,0,100);
            st.reputation=clamp(st.reputation+1,0,100);
            st=log(st,"😬 Got ink, cooked the pipe. Net -6 manager, -3 rep.","warn");
          }
        }
        st=checkRepo(st);
        st=checkBurnout(st);
        setS(st);
      };

      // v1.20: the Writing Lesson arrives after the run's report has played. It only opens on the run, week and clAInk run
      // that produced it (New Game or Load mid-report drop it), waits for the Rules to close, and gives way to any other
      // dialog: then it stays in the log only. It brings the run's result for screen readers, as v1.19's did.
      const helpOpen=useRef(false); helpOpen.current=showHelp;
      const lessonWait=useRef(null);
      const offerLesson=ev=>{
        const cur=sRef.current;
        if(!cur || isRunOver(cur) || ev.runId!==cur.runId || ev.week!==cur.week || !cur.claink || cur.claink.deploys!==ev.run)return;
        if(helpOpen.current){ lessonWait.current=ev; return; }
        setPending(p=>p||{title:ev.title,body:ev.body,options:[{label:ev.label,className:"primary",action:x=>x}]});
        if(ev.announce) setTimeout(()=>{
          const d=[...document.querySelectorAll("dialog[open]")].find(x=>{ const h=x.querySelector(".d-header"); return h && h.textContent===ev.title; });
          const sr=d && d.querySelector(".tst-sr");
          if(sr && sr.textContent!==ev.announce){ sr.textContent=""; sr.textContent=ev.announce; } // once, even if the run's own effect got there first
        },120);
      };
      useEffect(()=>{ if(!showHelp && lessonWait.current){ const ev=lessonWait.current; lessonWait.current=null; offerLesson(ev); } },[showHelp]);

      const opportunisticDisabled=(
        s.energy<10 || s.slots<=0 || s.fired || s.burnedOut || s.win || s.missed || s.repo || !hasLateDeal
      );

      return(
        <>
          <div className="grid">
            <div className="panel">
              <div className="row between wrap" style={{marginBottom:8}}>
                <h2>Quarter Map</h2>
                <div className="row wrap">
                  <span className="kbd">Week {weekInQuarter}/{QUARTER_WEEKS}</span>
                  <span className="kbd">Turn {s.week}</span>
                  <span className="kbd">Slots {s.slots}/{s.maxSlots}</span>
                  <span className="kbd">Run {s.runId.slice(0,5)}</span>
                  <button className="pill-btn" onClick={()=>{ setHelpOpens(n=>n+1); setShowHelp(true); }}>Rules</button>
                </div>
              </div>
              <div className="stats">
                <Stat label="Energy" num={s.energy} fmt={v=>`${Math.round(v)}/100`} barValue={s.energy} barKind={s.energy>50?"good":s.energy>25?"warn":"bad"} />
                <Stat label="Stress" num={s.stress} fmt={v=>`${Math.round(v)}/100`} barValue={s.stress} barKind={s.stress<40?"good":s.stress<70?"warn":"bad"}
                  sub={stressSub} />
                <Stat label="Cash" num={s.cash} fmt={money} sub="Salary + commission" />
                <Stat label="Pipeline" num={s.pipeline} fmt={money} sub={`${s.deals.length} live deals`} />
                <Stat label="Closed (Q)" num={s.closedQuarter} fmt={money} sub={`${pct(s.closedQuarter/s.quota)}% of quota • Pace ${pacePercent}%`} />
                <Stat label="Manager" num={s.manager} barValue={s.manager} />
                <Stat label="Prospecting" num={s.skills.prospect} barValue={s.skills.prospect} />
                <Stat label="Discovery" num={s.skills.discovery} barValue={s.skills.discovery} />
                <Stat label="Demo" num={s.skills.demo} barValue={s.skills.demo} />
                <Stat label="Negotiation" num={s.skills.negotiate} barValue={s.skills.negotiate} />
                <Stat label="Reputation" num={s.reputation} barValue={s.reputation} />
                <Stat label="Product" num={s.product} sub="How cursed the stack is" barValue={s.product} />
              </div>
              <div className="sep"></div>
              <Actions s={s} setS={setS} />
              <div className="footer">
                <div className="badge-row">
                  <span className="badge">Total Closed: {money(s.closedWon)}</span>
                  <span className="badge">Quota: {money(s.quota)}</span>
                  {s.pip && <span className="badge">📄 PIP L{(s.pipLevel||1)}</span>}
                  {s.modifiers.discount>0 && <span className="badge">🧾 Discount {pct(s.modifiers.discount)}%</span>}
                  {s.modifiers.conversion!==0 && <span className="badge">🎲 Conv Mod {s.modifiers.conversion>0?"+":""}{pct(s.modifiers.conversion)}%</span>}
                  {s.restedThisWeek && <span className="badge">🧘 Rested</span>}
                  {s.trip && <span className="badge">🏝️ {s.trip} trip approved</span>}
                  {s.claink && s.claink.status==="active" && <span className={"badge claink-badge"+(s.claink.strikes>=CLAINK.STRIKES-1?" hot":"")}>🤖 clAInk{s.claink.strikes>0 ? ` • ${s.claink.strikes}/${CLAINK.STRIKES} strikes` : " • live"}</span>}
                  {s.coffeesThisWeek>0 && <span className="badge">☕×{s.coffeesThisWeek}</span>}
                  {s.repo && <span className="badge">🧥 Jacket Repo’d</span>}
                </div>
                <div className="row right">
                  <button
                    className="btn ghost"
                    onClick={tryOpportunisticClose}
                    disabled={opportunisticDisabled}
                  >
                    🧪 Hail-Mary (10 Energy • 1 Slot • Risky)
                  </button>
                  <button
                    className={"btn primary"+(s.slots<=0 && !isRunOver(s) ? " nudge" : "")}
                    onClick={endWeek}
                    disabled={s.fired || s.burnedOut || s.win || s.missed || s.repo}
                  >
                    End Week
                  </button>
                </div>
              </div>
            </div>

            <div className="panel">
              <h2>Active Deals</h2>
              <div className="deal-list">
                {s.deals.length>0 ? (
                  s.deals.map(d=>(
                    <DealCard key={d.id} deal={d} />
                  ))
                ) : (
                  <div className="tiny">No deals. Start dialing.</div>
                )}
              </div>
              <div className="sep"></div>
              <h2>Activity Log</h2>
              <div className="log">
                {s.logs.length>0 ? (
                  s.logs.map(entry=>(
                    <p key={entry.id}>
                      <span className="muted">{entry.t}</span> — {entry.msg}
                    </p>
                  ))
                ) : (
                  <p className="muted">Nothing yet. Quota’s waiting.</p>
                )}
              </div>
            </div>
          </div>

          <ClainkDock key={s.runId+":"+epoch} s={s} setS={setS} ui={clainkUiFor(claUi,shortScreen)} setUi={setClaUiByYou} onEvent={offerLesson} />

          <Modal
            open={showHelp}
            title="How It Works"
            onDismiss={()=>setShowHelp(false)}
            actions={[
              {
                label:"Got it",
                className:"primary",
                onClick:()=>setShowHelp(false)
              }
            ]}
          >
            {helpOpens>0 && <WelcomeMemo key={helpOpens} active={showHelp} />}
            <p className="tiny"><strong>Energy</strong> fuels actions. Small refill at week end.</p>
            <p className="tiny"><strong>Recharge</strong> once a week: +{RECHARGE_ENERGY} energy, -12 stress, plus a 0–{pct(RECHARGE_LUCK)}% lucky bonus. Over {pct(TRIP_AT)}% and your manager signs off a trip. Coffee blunts it.</p>
            <p className="tiny"><strong>Stress</strong> hurts close rates. 80+ can melt you down at week end; 100 is instant.</p>
            <p className="tiny"><strong>Quad Shot</strong> hits harder each shot that week. Shot 3+ can put you in orbit; a shot to 100 stress will. Each one: +{CRASH_PER_SHOT} stress at week end, weaker Recharge.</p>
            <p className="tiny"><strong>CRM Cleanup</strong> weekly: prunes dead leads, +manager, freezes warnings, trims fire odds. Boss may nuke a good deal.</p>
            <p className="tiny"><strong>clAInk</strong> is a sponsored AI pilot. Close the ad and it's gone this run. A {money(CLAINK.INSTALL)} seat buys one agent run a week (no energy or slots; billed Friday, idle weeks too): 1 in 5 closes real deals, the rest burn tokens on billed “outcomes” and earn a strike from the AI Governance Council, sometimes with damage. Strike {CLAINK.STRIKES}: seat revoked, a deal walks, and a token true-up that takes all your cash and leaves you {money(CLAINK.TRUEUP_OVER[0])}–{money(CLAINK.TRUEUP_OVER[1])} in the red (more if you're already there). The pilot offer ends after week {CLAINK.OFFER_LAST_WEEK}. Your manager may notice: the first time is a warning to improve your writing, after that he steps into your deals.</p>
            <p className="tiny"><strong>Cash</strong> is salary and commission in, rent out. At -$1,500 the jacket goes.</p>
            <p className="tiny"><strong>Pipeline</strong> is the value of live deals. Actions move them down the funnel.</p>
            <p className="tiny"><strong>Closed (Q)</strong> is revenue this quarter. Behind pace from week 5? Warnings, or a surprise exit.</p>
            <p className="tiny"><strong>Manager</strong> nudges close odds, drives PIPs and firing. Emails without calls annoy them.</p>
            <p className="tiny"><strong>Reputation</strong> grows deal size and nudges close odds.</p>
            <p className="tiny"><strong>Product</strong> is how cursed the stack is. Low product sinks demos and closes.</p>
            <p className="tiny"><strong>Skills</strong> boost their matching action and feed the close math.</p>
            <p className="tiny"><strong>Modifiers</strong> are short-term close and discount effects from events and full-funnel weeks.</p>
          </Modal>

          <Modal
            open={!!pending}
            title={pending?.title || "Event"}
            actions={pending ? pending.options.map(opt=>({
              label:opt.label,
              className:opt.className||"ghost",
              onClick:()=>{
                let ns=checkBurnout(opt.action({...s}));
                setS(ns);
                setPending(null);
              }
            })) : []}
          >
            <p className="tiny">{pending?.body}</p>
          </Modal>

          <Modal
            open={!!over}
            title={over?.title || "Game Over"}
            actions={[
              {
                label:"New Run",
                className:"success",
                onClick:()=>{
                  const a=AUDIO(); if(a){ a.hush(); a.play("newgame"); a.say("newrun",{cooldown:3000}); }
                  setS(newGame());
                  setEpoch(e=>e+1); // v1.19: fresh clAInk UI state
                  expandAd();
                  setPending(null); // FIX: an event that fired on the final week no longer leaks into the next run
                  setOver(null);
                }
              }
            ]}
          >
            <p className="tiny">{over?.body}</p>
            <Cutscene
              type={over?.type || "club"}
              speed={asciiSpeed}
              play={!!over}
              meta={over?.meta}
              ctrlRef={sceneRef}
            />
            {REDUCED_MOTION && over && window.TST_SCENES && window.TST_SCENES.summaryFor(over.type,over.meta) && (
              <p className="tiny scene-note">{window.TST_SCENES.summaryFor(over.type,over.meta)}</p>
            )}
            {!REDUCED_MOTION && window.TST_SCENES && (
              <div className="row right scene-ctl">
                <button className="pill-btn" onClick={()=>{ if(sceneRef.current)sceneRef.current.skip(); }}>Skip to end</button>
                <button className="pill-btn" onClick={()=>{ if(sceneRef.current)sceneRef.current.replay(); }}>Replay</button>
              </div>
            )}
            <div className="row between" style={{marginTop:6}}>
              <div className="badge-row">
                <span className="badge">Total Closed: {money(s.closedWon)}</span>
                <span className="badge">Pipeline: {money(s.pipeline)}</span>
                <span className="badge">Total Discounts: {money(s.discounts)}</span>
              </div>
              <div className="row">
                <span className="tiny">ASCII speed</span>
                <button className="btn ghost" onClick={()=>setAsciiSpeed(p=>Math.max(60,p-20))}>Faster</button>
                <button className="btn ghost" onClick={()=>setAsciiSpeed(p=>Math.min(260,p+20))}>Slower</button>
              </div>
            </div>
          </Modal>
        </>
      );
    }

    ReactDOM.createRoot(document.getElementById("root")).render(<Game />);
