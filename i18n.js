"use strict";
// Language layer. index.html renders English; in Indonesian mode (?lang=id, or the ID button) every text is
// translated on its way to the page, so the model and the rendering code carry no per-string changes.
//
// How a text is translated (I18N.tr):
//   1. the whole text is looked up as it is in I18N_ID (lang-id.js) — this is how the static prose is translated,
//      numbers and ⟦math⟧ included, so the translation is free to reorder and reformat them;
//   2. otherwise numbers, with their unit where the unit varies ("$1.2 M", "38.1 t", "95.6 min", "5.50 km²"), are
//      lifted out and replaced by "#", giving a key such as "# launches at #/yr"; the translation puts them back in
//      order ("#") or in a chosen order ("#2" = second number), re-formatted for Indonesian (1,133.5 → 1.133,5);
//   3. if that fails too the text is split on " · ", then into sentences, then on ": ", and each part is tried;
//   4. what is still unknown stays English (numbers re-formatted) and is recorded in I18N.missing.
// Texts that reach the page through rich() and the verdict cards are translated as source strings, before they
// become HTML/MathML, and marked .notr; everything else is translated as text nodes by a MutationObserver.
// Reference links keep their English labels: they point to English sources.
const I18N=(()=>{
  const STORE="orbital-lang";
  const q=new URLSearchParams(location.search);
  let saved=null;try{saved=localStorage.getItem(STORE);}catch(e){}
  const lang=(q.get("lang")||saved||"en")==="id"?"id":"en";
  const root=document.documentElement;
  root.lang=lang;
  // The dictionary is only fetched when it is needed. It is written into the document so that it runs right after
  // this file and before the page script; .i18n-wait hides the body until start() has translated it.
  if(lang==="id"){root.classList.add("i18n-wait");document.write('<script src="lang-id.js"><\/script>');}
  const reveal=()=>root.classList.remove("i18n-wait");
  document.addEventListener("DOMContentLoaded",reveal);

  let dict;                                         // read on first use: lang-id.js runs after this file
  const D=()=>dict===undefined?(dict=lang==="id"&&window.I18N_ID?Object.assign(Object.create(null),window.I18N_ID):null):dict;
  const missing=new Set();

  // ---- numbers
  const NUM="(?:\\d+(?:[.,]\\d+)*(?:e[-+]?\\d+)?|∞|NaN|Infinity)";             // 1,133.5 · 3.72e-12 · what the formatters print for a division by zero
  const TOKEN=new RegExp(
    "[-−]?(?:\\$"+NUM+"(?: [TBMk](?![A-Za-z]))?"+                                 // $1.2 M, $25,000, −$0.080
    "|"+NUM+" (?:min|h|days|years|[TGMkm\\u00b5np]?(?:Wh|W|L|N)|kg|kt|Mt|t|km²|ha|m²)(?![A-Za-z²³])"+   // units the formatters switch between
    "|"+NUM+")"+
    "|effectively never|n\\/a"+                                                   // fmtTime's non-numbers
    "|\\b[A-Z][a-z]+(?:\\/[A-Z][A-Za-z_]+)+","g");                                // a time-zone name (Asia/Jakarta)
  const WORD={min:"menit",h:"jam",days:"hari",years:"tahun",T:"triliun",B:"miliar",M:"juta",k:"ribu","effectively never":"praktis tidak pernah","n/a":"tidak ada"};
  const swap=n=>n.replace(/[.,]/g,c=>c===","?".":",");
  function locToken(tok){
    if(WORD[tok])return WORD[tok];
    if(/^[A-Z]/.test(tok))return tok;
    const sp=tok.indexOf(" ");
    if(sp<0)return swap(tok);
    const u=tok.slice(sp+1);
    return swap(tok.slice(0,sp))+" "+(WORD[u]||u);
  }
  // Replace every number by "#", handing each localized number to out(). A leading minus belongs to the number
  // unless it follows a letter or digit, where it is a hyphen (S-1, 100-150).
  const lift=(text,out)=>text.replace(TOKEN,(t,off,str)=>{
    if(/^[-−]/.test(t)&&off>0&&/[A-Za-z0-9)]/.test(str[off-1])){out(locToken(t.slice(1)));return t[0]+"#";}
    out(locToken(t));return"#";
  });
  const locNums=s=>{const toks=[];return lift(s,t=>toks.push(t)).replace(/#/g,()=>toks.shift());};
  // Unit symbols and acronyms that read the same in both languages: a text made only of these needs no entry.
  const NEUTRAL=new Set("km kg kW kWh MW GW Wh CO gCO kgCO tCO PUE ISS LCOC LEO GEO DoD WUE CRF IT Al".split(" "));
  const bare=key=>!/[A-Za-z]{2}/.test(key.replace(/⟦[^⟧“"]*⟧/g,"").replace(/[A-Za-z]+/g,w=>NEUTRAL.has(w)?"":w));

  // ---- lookup
  function template(text){                         // numbers lifted out; returns the translation or null
    const toks=[];const key=lift(text,t=>toks.push(t));
    const tpl=dict[key];
    if(tpl===undefined)return bare(key)?key.replace(/#/g,()=>toks.shift()):null;
    let i=0;return tpl.replace(/#(\d)?/g,(_,n)=>n?toks[n-1]:toks[i++]);
  }
  const one=s=>dict[s]!==undefined?dict[s]:template(s);
  const miss=s=>{missing.add(lift(s,()=>{}));return locNums(s);};
  const SENT=/([.!?][)”"]?)\s+(?=[A-Z<])/g;
  function sentences(s){
    const out=[];let last=0,m;SENT.lastIndex=0;
    while((m=SENT.exec(s))){out.push(s.slice(last,m.index+m[1].length));last=SENT.lastIndex;}
    out.push(s.slice(last));return out;
  }
  function seg(s){
    const whole=one(s);if(whole!==null)return whole;
    const cut=s.lastIndexOf(": ");
    if(cut>0){
      const a=s.slice(0,cut),b=s.slice(cut+2),ta=one(a),tb=one(b);
      if(ta!==null||tb!==null)return(ta!==null?ta:miss(a))+": "+(tb!==null?tb:miss(b));
    }
    return miss(s);
  }
  function part(s){
    const whole=one(s);if(whole!==null)return whole;
    const ss=sentences(s);
    return ss.length>1?ss.map(seg).join(" "):seg(s);
  }
  function tr(text){
    if(!D()||!text||!/\S/.test(text)||/https?:\/\//.test(text))return text;
    const core=text.trim();
    let out=core.includes(" · ")?one(core):null;
    if(out===null)out=core.split(/ · (?![^⟦]*⟧)/).map(part).join(" · ");   // not inside ⟦math⟧
    return out===core?text:text.replace(core,()=>out);
  }

  // ---- DOM: translate text nodes and a few attributes as they are added
  const SKIP=".notr,.u,.sym,math,script,style";
  const done=new WeakMap(),adone=new WeakMap(),ATTRS=["title","aria-label","placeholder","alt"];
  function textNode(n){
    const p=n.parentNode;if(!p||p.nodeType!==1||p.closest(SKIP))return;
    const v=n.nodeValue;if(done.get(n)===v)return;
    const out=tr(v);done.set(n,out);if(out!==v)n.nodeValue=out;
  }
  function attrs(el){
    if(el.closest(SKIP))return;
    let rec=adone.get(el);
    for(const a of ATTRS){
      if(!el.hasAttribute(a))continue;
      const v=el.getAttribute(a);if(rec&&rec[a]===v)continue;
      const out=tr(v);if(!rec)adone.set(el,rec={});rec[a]=out;if(out!==v)el.setAttribute(a,out);
    }
  }
  function walk(node){
    if(node.nodeType===3){textNode(node);return;}
    if(node.nodeType!==1||node.closest(SKIP))return;
    attrs(node);node.querySelectorAll("[title],[aria-label],[placeholder],[alt]").forEach(attrs);
    const w=document.createTreeWalker(node,NodeFilter.SHOW_TEXT),list=[];
    while(w.nextNode())list.push(w.currentNode);
    list.forEach(textNode);
  }
  const api={lang,tr,start,setLang,missing,beforeSwitch:null,get dict(){return D();}};
  function start(){                                // call once the page has rendered
    document.querySelectorAll("[data-lang]").forEach(b=>{
      const on=b.dataset.lang===lang;
      b.classList.toggle("on",on);b.setAttribute("aria-pressed",on);
      b.addEventListener("click",()=>setLang(b.dataset.lang));
    });
    if(D()){
      document.title=tr(document.title);
      const md=document.querySelector('meta[name="description"]');if(md)md.setAttribute("content",tr(md.getAttribute("content")));
      walk(document.body);
      new MutationObserver(ms=>{for(const m of ms){if(m.type==="characterData")textNode(m.target);else m.addedNodes.forEach(n=>walk(n));}})
        .observe(document.body,{childList:true,subtree:true,characterData:true});
    }
    reveal();
  }
  function setLang(l){                             // reloads: the address bar carries the whole scenario
    if(l===lang)return;
    try{localStorage.setItem(STORE,l);}catch(e){}
    if(api.beforeSwitch)api.beforeSwitch();
    const p=new URLSearchParams(location.search);p.set("lang",l);location.search=p.toString();
  }
  return api;
})();
