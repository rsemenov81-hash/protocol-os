
const { useState, useEffect, useRef, useMemo, useCallback } = React;
const { LayoutDashboard, Package, Beaker, Clock, Calculator, BookOpen, Bot,
  CheckCircle, AlertTriangle, Plus, Edit2, Trash2, X, Download, Upload,
  Search, ShieldAlert, ArrowRight, Check, Activity, Info, Zap, Target,
  TrendingUp, TrendingDown, Calendar, DollarSign, Layers, Heart, Moon,
  Smile, Frown, Meh, Battery, Droplet, AlertCircle, Filter, Star, Bell,
  BarChart2, ChevronLeft, ChevronRight } = LucideReact;
const Sparkles = Star;

// D6 live reduced-motion gate — a media-query SUBSCRIPTION, not a load-time snapshot,
// so an iOS user toggling Reduce Motion mid-session is respected immediately.
const useReducedMotion = () => {
  const [rm, setRm] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const f = e => setRm(e.matches);
    m.addEventListener ? m.addEventListener('change', f) : m.addListener(f);
    return () => { m.removeEventListener ? m.removeEventListener('change', f) : m.removeListener(f); };
  }, []);
  return rm;
};

const PEPTIDE_DB = [
  {id:"ipamorelin",name:"Ipamorelin",category:"GH Secretagogue",icon:"💤",purpose:"Selective ghrelin mimetic that triggers pulsatile growth hormone release without significantly raising cortisol or prolactin.",benefits:["Improved sleep depth","Lean recomposition","Recovery and joint comfort","Mild fat loss"],protocol:{doseRange:"100–300 mcg",defaultDoseMcg:200,timing:"Nighttime, fasted",cycle:"5 on / 2 off · 8–12w",cycleDays:60,route:"SubQ"},reconstitution:{typicalVialMg:5,defaultDiluentMl:2},synergy:["CJC-1295 (no DAC)","Tesamorelin","BPC-157"],avoid:["Other GHRPs same dose","Eating within ~2h of dose"],contraindications:["Active malignancy","Pregnancy","Severe diabetic retinopathy"]},
  {id:"cjc1295-no-dac",name:"CJC-1295 (no DAC)",category:"GHRH Analog",icon:"⚡",purpose:"Short-acting GHRH analog that amplifies endogenous GH pulses; pairs synergistically with GHRPs.",benefits:["Amplifies natural GH pulse","Sleep, recovery, body composition","Preserves pulsatile pattern"],protocol:{doseRange:"100–200 mcg",defaultDoseMcg:100,timing:"With paired GHRP, fasted",cycle:"5 on / 2 off · 8–12w",cycleDays:60,route:"SubQ"},reconstitution:{typicalVialMg:2,defaultDiluentMl:2},synergy:["Ipamorelin (gold-standard combo)","Tesamorelin"],avoid:["CJC-1295 with DAC simultaneously","Long-term continuous use"],contraindications:["Active malignancy","Pregnancy"]},
  {id:"cjc1295-dac",name:"CJC-1295 with DAC",category:"GHRH Analog",icon:"⚡",purpose:"Long-acting GHRH analog (~7 day half-life) producing sustained elevation of GH/IGF-1.",benefits:["Steady IGF-1 elevation","Convenient weekly dosing","Strong recomp signal"],protocol:{doseRange:"1–2 mg weekly",defaultDoseMcg:1000,timing:"Any time, weekly",cycle:"8–12w · break 4w",cycleDays:60,route:"SubQ"},reconstitution:{typicalVialMg:2,defaultDiluentMl:2},synergy:["Standalone","Optional Ipamorelin pulse"],avoid:["Short-acting GHRH same protocol","Continuous year-round use"],contraindications:["Active malignancy","Severe insulin resistance","Pregnancy"]},
  {id:"ipa-cjc",ingredients:{"cjc1295-no-dac":0.5,"ipamorelin":0.5},name:"Ipamorelin + CJC-1295",category:"GH Secretagogue",icon:"✨",purpose:"Gold-standard pairing: GHRH analog amplifies the natural pulse, GHRP triggers release.",benefits:["Strong but physiological GH pulse","Improved deep sleep","Lean recomp, recovery","Lower cortisol/prolactin"],protocol:{doseRange:"100–200 mcg of EACH",defaultDoseMcg:200,timing:"Nighttime, strict fasted",cycle:"5 on / 2 off · 8–12w",cycleDays:60,route:"SubQ"},reconstitution:{typicalVialMg:5,defaultDiluentMl:2},synergy:["Tesamorelin (advanced)","Epitalon"],avoid:["Eating within ~2h","Other GHRPs simultaneously"],contraindications:["Active malignancy","Pregnancy","Severe retinopathy"]},
  {id:"tesamorelin",name:"Tesamorelin",category:"GHRH Analog",icon:"🔥",purpose:"Stabilized GHRH (FDA-approved) with strong visceral fat reduction profile.",benefits:["Visceral adipose reduction","IGF-1 elevation","Lipid panel improvements","Cognitive support"],protocol:{doseRange:"1–2 mg AM fasted",defaultDoseMcg:1000,timing:"AM, strict fasted",cycle:"5 on / 2 off · 8–12w",cycleDays:60,route:"SubQ"},reconstitution:{typicalVialMg:5,defaultDiluentMl:2},synergy:["Ipamorelin","Fasted cardio"],avoid:["Other GHRH analogs simultaneously","Carb-heavy meals near dose"],contraindications:["Active malignancy","Pregnancy","Diabetic retinopathy"]},
  {id:"sermorelin",name:"Sermorelin",category:"GHRH Analog",icon:"🌙",purpose:"First-generation GHRH(1-29) producing gentler GH pulse amplification.",benefits:["Mild sleep and recovery support","Anti-aging (gentle)","Well tolerated entry-level"],protocol:{doseRange:"200–500 mcg nightly",defaultDoseMcg:300,timing:"Nighttime, fasted",cycle:"3–6 months on / break",cycleDays:90,route:"SubQ"},reconstitution:{typicalVialMg:5,defaultDiluentMl:5},synergy:["GHRPs (Ipamorelin)"],avoid:["Other GHRH analogs same dose"],contraindications:["Active malignancy","Pregnancy"]},
  {id:"hexarelin",name:"Hexarelin",category:"GHRP",icon:"💥",purpose:"Potent GHRP with strong GH-release action; rapid receptor desensitization with continuous use.",benefits:["Strong GH pulse (short-term)","Cardio-protective at low doses"],protocol:{doseRange:"100 mcg 1–2× daily",defaultDoseMcg:100,timing:"Fasted",cycle:"Max 4–6 weeks · long break",cycleDays:35,route:"SubQ"},reconstitution:{typicalVialMg:2,defaultDiluentMl:2},synergy:["Short cycles with GHRH"],avoid:["Long-term use","Other GHRPs same day"],contraindications:["Cortisol/prolactin imbalance","Active malignancy"]},
  {id:"mk677",name:"MK-677 (Ibutamoren)",category:"GH Secretagogue",icon:"💊",purpose:"Non-peptide ghrelin receptor agonist with long half-life; orally bioavailable.",benefits:["Sleep depth","Appetite increase","IGF-1 elevation","Convenience (oral)"],protocol:{doseRange:"10–25 mg oral",defaultDoseMcg:12500,timing:"Evening (causes drowsiness)",cycle:"8–12w on / break",cycleDays:60,route:"Oral"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:["Standalone","Light Ipamorelin pulse"],avoid:["Insulin-resistance prone phases"],contraindications:["Diabetes","CHF","Active malignancy"]},
  {id:"ghk-cu",name:"GHK-Cu",category:"Tissue / Cosmetic",icon:"💎",purpose:"Copper tripeptide with skin remodeling, hair growth, and broad regenerative effects.",benefits:["Hair growth","Skin elasticity / collagen","Wound healing","Anti-inflammatory"],protocol:{doseRange:"1–2 mg SubQ nightly",defaultDoseMcg:1500,timing:"Nighttime",cycle:"30 on / 30 off",cycleDays:30,route:"SubQ"},reconstitution:{typicalVialMg:50,defaultDiluentMl:5},synergy:["Microneedling (topical)","TB-500 / BPC-157"],avoid:["Wilson's disease","Excessive oral copper"],contraindications:["Wilson's disease","Hemochromatosis"]},
  {id:"bpc157",name:"BPC-157",category:"Healing",icon:"🩹",purpose:"Body Protective Compound — broad cytoprotective, angiogenic, tendon-healing peptide.",benefits:["Tendon / joint healing","Gut lining repair","Neuroprotection","Vascular healing"],protocol:{doseRange:"250–500 mcg daily",defaultDoseMcg:500,timing:"AM/PM, any food state",cycle:"4–6 weeks on, break",cycleDays:35,route:"SubQ"},reconstitution:{typicalVialMg:5,defaultDiluentMl:2},synergy:["TB-500","GHK-Cu","Thymosin Alpha-1"],avoid:["Continuous year-round use"],contraindications:["Active malignancy (caution)"]},
  {id:"tb500",name:"TB-500 (Thymosin Beta-4)",category:"Healing",icon:"🧬",purpose:"Actin-binding peptide promoting cellular migration, tissue repair, inflammation modulation.",benefits:["Systemic soft-tissue healing","Wound repair","Hair regrowth","Cardiac repair"],protocol:{doseRange:"2–2.5 mg twice weekly",defaultDoseMcg:2500,timing:"Any time",cycle:"4–8 week loading",cycleDays:42,route:"SubQ or IM"},reconstitution:{typicalVialMg:5,defaultDiluentMl:2.5},synergy:["BPC-157 (synergistic)"],avoid:["Indefinite continuous loading"],contraindications:["Active malignancy (caution)"]},
  {id:"bpc-tb",ingredients:{"bpc157":0.5,"tb500":0.5},name:"BPC-157 + TB-500",category:"Healing",icon:"🛡️",purpose:"Synergistic systemic healing: BPC-157 daily + TB-500 twice weekly.",benefits:["Faster soft-tissue recovery","Comprehensive systemic repair","Reduced injury downtime"],protocol:{doseRange:"BPC: 250–500 mcg · TB: 2–2.5 mg 2×/wk",defaultDoseMcg:500,timing:"BPC: AM/PM · TB: any time",cycle:"4–6 weeks · break",cycleDays:35,route:"SubQ"},reconstitution:{typicalVialMg:5,defaultDiluentMl:2},synergy:["GHK-Cu","Ipamorelin"],avoid:["Active malignancy"],contraindications:["Active malignancy (caution)"]},
  {id:"thymosin-a1",name:"Thymosin Alpha-1",category:"Immune",icon:"🛡️",purpose:"Endogenous immunomodulator promoting T-cell maturation and Th1 immune balance.",benefits:["Immune resilience","Post-illness recovery","Immunosenescence support"],protocol:{doseRange:"1.6 mg 2× weekly",defaultDoseMcg:1600,timing:"Any time",cycle:"4–8 weeks",cycleDays:42,route:"SubQ"},reconstitution:{typicalVialMg:5,defaultDiluentMl:2.5},synergy:["BPC-157","Post-viral recovery"],avoid:["Active autoimmune flare"],contraindications:["Active autoimmune disease"]},
  {id:"epitalon",name:"Epitalon",category:"Longevity",icon:"⏳",purpose:"Synthetic pineal tetrapeptide; may upregulate telomerase and restore circadian melatonin rhythm.",benefits:["Sleep regulation","Melatonin pulse restoration","Longevity / telomere markers"],protocol:{doseRange:"100 mcg – 1 mg nightly",defaultDoseMcg:200,timing:"Nighttime, 2+ hr fasted",cycle:"10–20 days · 4–6 mo break",cycleDays:14,route:"SubQ"},reconstitution:{typicalVialMg:10,defaultDiluentMl:2},synergy:["GH secretagogues (separate)","NAD+"],avoid:["Continuous daily use beyond 20 days"],contraindications:["Pregnancy","Active malignancy"]},
  {id:"mots-c",name:"MOTS-c",category:"Mitochondrial",icon:"⚙️",purpose:"Mitochondrial-derived peptide that activates AMPK and modulates metabolic homeostasis.",benefits:["Insulin sensitivity","Exercise performance / VO2","Fat oxidation","Metabolic flexibility"],protocol:{doseRange:"5–10 mg, 2–3× weekly",defaultDoseMcg:10000,timing:"Pre-workout",cycle:"4–6 weeks · break",cycleDays:35,route:"SubQ"},reconstitution:{typicalVialMg:10,defaultDiluentMl:2},synergy:["NAD+","SS-31"],avoid:["Concurrent hypoglycemia-prone fasting"],contraindications:["Hypoglycemia susceptibility","Pregnancy"]},
  {id:"ss31",name:"SS-31 (Elamipretide)",category:"Mitochondrial",icon:"⚛️",purpose:"Cardiolipin-stabilizing peptide protecting inner mitochondrial membrane integrity.",benefits:["Mitochondrial membrane stabilization","Cardiac/skeletal muscle protection","Energy improvement"],protocol:{doseRange:"4 mg daily (split AM/PM)",defaultDoseMcg:4000,timing:"AM and evening",cycle:"4–6 weeks",cycleDays:35,route:"SubQ"},reconstitution:{typicalVialMg:50,defaultDiluentMl:5},synergy:["Run BEFORE MOTS-c"],avoid:["No major interactions documented"],contraindications:["Pregnancy","Severe cardiac arrhythmia"]},
  {id:"nad",name:"NAD+ (injectable)",category:"Mitochondrial",icon:"⚡",purpose:"Coenzyme essential for sirtuin activation, redox balance, mitochondrial energy.",benefits:["Cellular energy","Sirtuin / longevity signaling","Cognitive clarity","Recovery"],protocol:{doseRange:"50–100 mg, 2–3× weekly",defaultDoseMcg:100000,timing:"Daytime — inject SLOWLY",cycle:"Indefinite cyclic",cycleDays:30,route:"SubQ (slow)"},reconstitution:{typicalVialMg:500,defaultDiluentMl:5},synergy:["MOTS-c","Oral NMN/NR"],avoid:["Fast injection","Pre-bed"],contraindications:["Pregnancy","Active anxiety disorder"]},
  {id:"semax",name:"Semax",category:"Cognitive",icon:"🧠",purpose:"ACTH(4-10) analog with neuroprotective and BDNF-modulating effects.",benefits:["Focus, attention, mental energy","BDNF expression","Neuroprotection"],protocol:{doseRange:"200–1000 mcg intranasal",defaultDoseMcg:600,timing:"AM / early afternoon",cycle:"10–14 days · break",cycleDays:12,route:"Intranasal"},reconstitution:{typicalVialMg:30,defaultDiluentMl:5},synergy:["Selank (AM/PM)","Cerebrolysin"],avoid:["Late-evening dosing"],contraindications:["Severe anxiety disorder","Pregnancy"]},
  {id:"selank",name:"Selank",category:"Cognitive",icon:"🌊",purpose:"Tuftsin analog with anxiolytic, immunomodulatory, gentle cognitive effects.",benefits:["Anxiety reduction","Calm focus","Mood support"],protocol:{doseRange:"250–500 mcg intranasal",defaultDoseMcg:400,timing:"Any time",cycle:"10–14 days · break",cycleDays:12,route:"Intranasal"},reconstitution:{typicalVialMg:5,defaultDiluentMl:5},synergy:["Semax (AM/PM)"],avoid:["No significant negatives"],contraindications:["Pregnancy"]},
  {id:"tirzepatide",name:"Tirzepatide",category:"GLP-1 / Metabolic",icon:"📉",purpose:"Dual GIP/GLP-1 receptor agonist for glucose control and significant weight reduction.",benefits:["Strong weight loss","A1c reduction","Appetite / satiety modulation"],protocol:{doseRange:"2.5 mg → 5–15 mg weekly",defaultDoseMcg:2500,timing:"Same day weekly",cycle:"Long-term, slow titration",cycleDays:84,route:"SubQ"},reconstitution:{typicalVialMg:10,defaultDiluentMl:1},synergy:["Cagrilintide","Resistance training"],avoid:["Other GLP-1s simultaneously","Rapid up-titration"],contraindications:["Personal/family MTC","MEN2","Severe gastroparesis","Pregnancy"]},
  {id:"semaglutide",name:"Semaglutide",category:"GLP-1 / Metabolic",icon:"📉",purpose:"Long-acting GLP-1 receptor agonist for type-2 diabetes and obesity.",benefits:["Weight loss","A1c reduction","Cardiovascular benefit"],protocol:{doseRange:"0.25 mg → 2.4 mg weekly",defaultDoseMcg:250,timing:"Same day weekly",cycle:"Long-term, slow titration",cycleDays:84,route:"SubQ"},reconstitution:{typicalVialMg:5,defaultDiluentMl:2},synergy:["Cagrilintide"],avoid:["Other GLP-1s simultaneously"],contraindications:["Personal/family MTC","MEN2","Severe gastroparesis"]},
  {id:"retatrutide",name:"Retatrutide (3RT)",category:"GLP-1 / Metabolic",icon:"📉",purpose:"Triple agonist (GLP-1 / GIP / glucagon) with the strongest weight-loss data.",benefits:["Aggressive weight reduction","A1c improvement","Hepatic fat reduction"],protocol:{doseRange:"1 mg → 12 mg weekly",defaultDoseMcg:1000,timing:"Same day weekly",cycle:"Long-term, slow titration",cycleDays:84,route:"SubQ"},reconstitution:{typicalVialMg:10,defaultDiluentMl:1},synergy:["Cagrilintide","Resistance training"],avoid:["Other GLP-1s simultaneously"],contraindications:["Personal/family MTC","MEN2","Severe gastroparesis"]},
  {id:"cagrilintide",name:"Cagrilintide",category:"GLP-1 / Metabolic",icon:"📉",purpose:"Long-acting amylin analog enhancing satiety; pairs with GLP-1 agonists.",benefits:["Satiety amplification","Slower gastric emptying","Smoother glucose"],protocol:{doseRange:"0.16–2.4 mg weekly",defaultDoseMcg:600,timing:"Same day weekly",cycle:"Long-term titration",cycleDays:84,route:"SubQ"},reconstitution:{typicalVialMg:5,defaultDiluentMl:1},synergy:["Semaglutide","Tirzepatide","Retatrutide"],avoid:["Solo amylin without GLP-1"],contraindications:["Severe gastroparesis","Pregnancy"]},
  {id:"melanotan2",name:"Melanotan II",category:"Tissue / Cosmetic",icon:"☀️",purpose:"Melanocortin receptor agonist increasing eumelanin (tan) with libido side effects.",benefits:["Tanning with reduced UV","Libido (MC4R)"],protocol:{doseRange:"0.25–1 mg, 2–3× weekly",defaultDoseMcg:500,timing:"Evening (reduces nausea)",cycle:"Loading → maintenance",cycleDays:30,route:"SubQ"},reconstitution:{typicalVialMg:10,defaultDiluentMl:5},synergy:["UV exposure"],avoid:["PT-141 same day","Atypical moles"],contraindications:["Melanoma history","Atypical moles","Uncontrolled HTN"]},
  {id:"pt141",name:"PT-141 (Bremelanotide)",category:"Tissue / Cosmetic",icon:"❤️",purpose:"Melanocortin agonist for libido and sexual function (FDA-approved as Vyleesi).",benefits:["Libido enhancement","Erectile function","Centrally-acting"],protocol:{doseRange:"0.5–2 mg as needed",defaultDoseMcg:1000,timing:"45 min before activity",cycle:"As-needed",cycleDays:30,route:"SubQ"},reconstitution:{typicalVialMg:10,defaultDiluentMl:2},synergy:["Standalone"],avoid:["Melanotan II same day","Hypertension"],contraindications:["Cardiovascular disease","Uncontrolled HTN"]},
  {id:"kpv",name:"KPV",category:"Healing",icon:"🌿",purpose:"Tripeptide derived from α-MSH with anti-inflammatory effects.",benefits:["Gut inflammation reduction","Anti-inflammatory","Wound healing"],protocol:{doseRange:"200–500 mcg daily",defaultDoseMcg:500,timing:"AM, fasted",cycle:"4–6 weeks",cycleDays:35,route:"SubQ or oral"},reconstitution:{typicalVialMg:5,defaultDiluentMl:2},synergy:["BPC-157 (gut healing)"],avoid:["No major issues documented"],contraindications:["Pregnancy"]},
  {id:"dsip",name:"DSIP",category:"Cognitive",icon:"😴",purpose:"Delta Sleep-Inducing Peptide; may improve sleep architecture and pain modulation.",benefits:["Improved sleep onset","Slow-wave sleep","Pain modulation"],protocol:{doseRange:"100–500 mcg pre-bed",defaultDoseMcg:200,timing:"30 min before sleep",cycle:"5–10 nights · break",cycleDays:10,route:"SubQ"},reconstitution:{typicalVialMg:5,defaultDiluentMl:2},synergy:["Epitalon","Magnesium"],avoid:["Other sedatives"],contraindications:["Pregnancy"]},
  {id:"humanin",name:"Humanin",category:"Mitochondrial",icon:"⚛️",purpose:"Mitochondrial-derived peptide with broad metabolic, neuroprotective, and cardiovascular effects.",benefits:["Mitochondrial protection","Insulin sensitivity","Cognitive support","Cardiovascular health"],protocol:{doseRange:"1 mg 3× weekly (M/W/F)",defaultDoseMcg:1000,timing:"AM pre-cardio",cycle:"4-6 weeks",cycleDays:35,route:"SubQ"},reconstitution:{typicalVialMg:5,defaultDiluentMl:2},synergy:["MOTS-c","SS-31"],avoid:["Concurrent strong glucose lowering"],contraindications:["Pregnancy"]},
  {id:"frag-176-191",name:"HGH Frag 176-191",category:"GH Secretagogue",icon:"🔥",purpose:"GH C-terminal fragment promoting fat oxidation without raising IGF-1 or affecting glucose.",benefits:["Targeted fat loss","No IGF-1 elevation","Pre-workout fat oxidation"],protocol:{doseRange:"200-500 mcg pre-workout",defaultDoseMcg:200,timing:"AM fasted, pre-workout",cycle:"4-12 weeks",cycleDays:60,route:"SubQ"},reconstitution:{typicalVialMg:5,defaultDiluentMl:2},synergy:["Fasted cardio","CJC-1295"],avoid:["Eating immediately before/after"],contraindications:["Pregnancy"]},
  {id:"ace-031",name:"ACE-031",category:"GH Secretagogue",icon:"💪",purpose:"Soluble activin receptor type IIB that inhibits myostatin pathway for muscle growth.",benefits:["Myostatin inhibition","Muscle hypertrophy","Bone density"],protocol:{doseRange:"1 mg over 2 weeks",defaultDoseMcg:500,timing:"Any time",cycle:"2-4 weeks",cycleDays:14,route:"SubQ"},reconstitution:{typicalVialMg:1,defaultDiluentMl:1},synergy:["Resistance training","Follistatin"],avoid:["Long-term use without monitoring"],contraindications:["Pregnancy","Cardiovascular disease"]},
  {id:"follistatin",name:"Follistatin",category:"GH Secretagogue",icon:"💪",purpose:"Glycoprotein that binds and inhibits myostatin, promoting strong muscle growth.",benefits:["Strong muscle hypertrophy","Myostatin neutralization","Recovery"],protocol:{doseRange:"100 mcg - 1 mg",defaultDoseMcg:1000,timing:"Any time",cycle:"Single shot or short cycle",cycleDays:10,route:"SubQ"},reconstitution:{typicalVialMg:1,defaultDiluentMl:1},synergy:["Resistance training","ACE-031"],avoid:["Excessive dosing"],contraindications:["Pregnancy"]},
  {id:"cerebrolysin",name:"Cerebrolysin",category:"Cognitive",icon:"🧠",purpose:"Porcine brain-derived neurotrophic factors mixture; massively boosts BDNF.",benefits:["Massive BDNF boost","Neuroprotection","Cognitive enhancement","Stroke recovery research"],protocol:{doseRange:"5-10 mL (split L/R shoulder)",defaultDoseMcg:10000,timing:"Evening, every 2-3 days",cycle:"2 weeks",cycleDays:14,route:"IM"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:["Semax","Selank"],avoid:["Concurrent SSRIs (caution)"],contraindications:["Severe kidney disease","Pregnancy"]},
  {id:"pe-22-28",name:"PE-22-28",category:"Cognitive",icon:"🌊",purpose:"Spadin analog with antidepressant and neuroprotective effects via TREK-1 inhibition.",benefits:["Mental workflow / focus","Calmness","Mood elevation","Anti-anxiety"],protocol:{doseRange:"500 mcg daily",defaultDoseMcg:500,timing:"AM, M-F",cycle:"4 weeks",cycleDays:28,route:"SubQ"},reconstitution:{typicalVialMg:5,defaultDiluentMl:2},synergy:["Selank","Semax"],avoid:["Late-evening dosing"],contraindications:["Pregnancy"]},
  {id:"foxo4-dri",name:"FOXO4-DRI",category:"Longevity",icon:"⏳",purpose:"Senolytic peptide that selectively triggers apoptosis in senescent cells.",benefits:["Clears senescent cells","Anti-aging signaling","Tissue rejuvenation"],protocol:{doseRange:"5-10 mg total over weekend",defaultDoseMcg:5000,timing:"Sat AM + Sun AM",cycle:"2-day burst, 2-3× year",cycleDays:2,route:"SubQ"},reconstitution:{typicalVialMg:10,defaultDiluentMl:2},synergy:["Cycle every 3-6 months"],avoid:["Continuous use","Active infection"],contraindications:["Pregnancy","Active malignancy"]},
  {id:"thymalin",name:"Thymalin",category:"Immune",icon:"🛡️",purpose:"Thymus extract bioregulator; regenerates the thymus gland and boosts immune cells.",benefits:["Thymus regeneration","NK cell boost","Immunosenescence reversal"],protocol:{doseRange:"10 mg daily",defaultDoseMcg:10000,timing:"Any time",cycle:"10 days · cycle every 6 months",cycleDays:10,route:"IM"},reconstitution:{typicalVialMg:10,defaultDiluentMl:2},synergy:["Thymosin Alpha-1"],avoid:["Active autoimmune flare"],contraindications:["Active autoimmune","Organ transplant"]},
  {id:"vip",name:"VIP",category:"Immune",icon:"🌬️",purpose:"Vasoactive Intestinal Peptide; lowers BP, modulates inflammation, supports cognition.",benefits:["Blood pressure reduction","Cognitive multitasking","Anti-inflammatory","Mast cell stability"],protocol:{doseRange:"100 mcg daily",defaultDoseMcg:100,timing:"AM pre-workout",cycle:"5 days/wk or 16 days straight",cycleDays:16,route:"SubQ or intranasal"},reconstitution:{typicalVialMg:1,defaultDiluentMl:1},synergy:["Anti-inflammatory stacks"],avoid:["Hypotension"],contraindications:["Severe hypotension","Pregnancy"]},
  {id:"ll-37",name:"LL-37",category:"Immune",icon:"🦠",purpose:"Cathelicidin antimicrobial peptide with broad antibacterial/antifungal activity.",benefits:["Antimicrobial","Antifungal","Wound healing","Immune modulation"],protocol:{doseRange:"100-500 mcg local",defaultDoseMcg:300,timing:"Local injection at site",cycle:"As needed",cycleDays:14,route:"SubQ (local)"},reconstitution:{typicalVialMg:5,defaultDiluentMl:2},synergy:["Topical antifungals"],avoid:["Systemic high-dose without monitoring"],contraindications:["Pregnancy"]},
  {id:"kisspeptin-10",name:"Kisspeptin-10",category:"GLP-1 / Metabolic",icon:"❤️",purpose:"Neuropeptide that triggers GnRH release; supports HPG axis function.",benefits:["LH/FSH/Test elevation","Libido","Fertility support"],protocol:{doseRange:"250 mcg 3× weekly",defaultDoseMcg:250,timing:"AM",cycle:"6-8 weeks",cycleDays:45,route:"SubQ"},reconstitution:{typicalVialMg:5,defaultDiluentMl:2},synergy:["Standalone or with HCG"],avoid:["Concurrent strong HPG suppressants"],contraindications:["Hormone-sensitive cancers","Pregnancy"]},
  {id:"oxytocin",name:"Oxytocin",category:"Tissue / Cosmetic",icon:"💗",purpose:"Bonding hormone with effects on social cognition, mood, and sexual response.",benefits:["Mood elevation","Bonding / social","Anti-anxiety","Libido"],protocol:{doseRange:"100-150 mcg daily",defaultDoseMcg:150,timing:"Early evening (~6 PM)",cycle:"Up to 10 weeks",cycleDays:70,route:"SubQ"},reconstitution:{typicalVialMg:2,defaultDiluentMl:2},synergy:["Standalone"],avoid:["Hyponatremia risk"],contraindications:["Severe heart disease","Pregnancy"]},
  {id:"cartalax",name:"Cartalax",category:"Healing",icon:"🦴",purpose:"Cartilage tissue bioregulator; supports joint and connective tissue repair.",benefits:["Cartilage repair","Joint support","Connective tissue regeneration"],protocol:{doseRange:"2 caps 2×/day OR 2 mg/day inj",defaultDoseMcg:2000,timing:"AM/PM",cycle:"10-15 days",cycleDays:15,route:"Oral or SubQ"},reconstitution:{typicalVialMg:2,defaultDiluentMl:1},synergy:["BPC-157","TB-500"],avoid:["No major issues"],contraindications:["Pregnancy"]},
  {id:"pielotax",name:"Pielotax",category:"Healing",icon:"🧫",purpose:"Kidney tissue bioregulator (oral capsules); supports renal function.",benefits:["Kidney function support","Tissue bioregulation"],protocol:{doseRange:"2 caps AM × 15 days",defaultDoseMcg:0,timing:"AM, before breakfast",cycle:"15 days",cycleDays:15,route:"Oral"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:["Reini Salman"],avoid:["No major issues"],contraindications:["Pregnancy"]},
  {id:"svetinorm",name:"Svetinorm",category:"Healing",icon:"🫁",purpose:"Liver tissue bioregulator (oral); supports hepatic function and detox.",benefits:["Liver support","Detox support"],protocol:{doseRange:"2 caps daily (AM/PM)",defaultDoseMcg:0,timing:"Empty stomach AM/PM",cycle:"30 days",cycleDays:30,route:"Oral"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:["Hepatamin"],avoid:["No major issues"],contraindications:["Pregnancy"]},
  {id:"ventfort",name:"Ventfort",category:"Healing",icon:"🩸",purpose:"Vascular tissue bioregulator (oral); supports blood vessel and endothelial health.",benefits:["Vascular support","Endothelial function"],protocol:{doseRange:"2 caps daily",defaultDoseMcg:0,timing:"AM/PM before meals",cycle:"15 days",cycleDays:15,route:"Oral"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:["NAD+","SS-31"],avoid:["No major issues"],contraindications:["Pregnancy"]},
  {id:"vilon",name:"Vilon",category:"Immune",icon:"🛡️",purpose:"Immune tissue bioregulator (short peptide); supports immunity.",benefits:["Immune support","Bioregulation"],protocol:{doseRange:"2 mg daily",defaultDoseMcg:2000,timing:"Any time",cycle:"10 days",cycleDays:10,route:"SubQ"},reconstitution:{typicalVialMg:2,defaultDiluentMl:1},synergy:["Thymalin","TA-1"],avoid:["No major issues"],contraindications:["Pregnancy"]},
  {id:"hepatamin",name:"Hepatamin",category:"Healing",icon:"🫁",purpose:"Liver organ-derived bioregulator (oral capsules).",benefits:["Liver function support","Detox"],protocol:{doseRange:"Per package directions",defaultDoseMcg:0,timing:"AM",cycle:"20 days",cycleDays:20,route:"Oral"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:["Svetinorm"],avoid:["No major issues"],contraindications:["Pregnancy"]},
  {id:"reini-salman",name:"Reini Salman",category:"Healing",icon:"🧫",purpose:"Kidney bioregulator (alternative oral formulation).",benefits:["Kidney support"],protocol:{doseRange:"4 pills daily",defaultDoseMcg:0,timing:"AM/PM before eating",cycle:"10 days",cycleDays:10,route:"Oral"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:["Pielotax"],avoid:["No major issues"],contraindications:["Pregnancy"]},
  {id:"5-amino-1mq",name:"5-Amino-1MQ",category:"GLP-1 / Metabolic",icon:"📉",purpose:"NNMT inhibitor (small molecule) that boosts SAM and NAD+ for fat loss and metabolism.",benefits:["Fat loss","Metabolic flexibility","NAD+ boost","Insulin sensitivity"],protocol:{doseRange:"50 mg rest, 100 mg cardio days",defaultDoseMcg:50000,timing:"AM",cycle:"30-42 days",cycleDays:35,route:"Oral"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:["MOTS-c","Cardio"],avoid:["No major issues"],contraindications:["Pregnancy"]},
  {id:"slu-pp-332",name:"SLU-PP-332",category:"GLP-1 / Metabolic",icon:"⚡",purpose:"ERR (estrogen-related receptor) agonist (small molecule); exercise mimetic.",benefits:["Endurance enhancement","Fat oxidation","Mitochondrial biogenesis"],protocol:{doseRange:"500-1000 mcg",defaultDoseMcg:1000,timing:"Pre-workout AM",cycle:"4-6 weeks",cycleDays:35,route:"Oral"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:["MOTS-c","Cardio"],avoid:["Excessive dosing"],contraindications:["Pregnancy"]},
  {id:"hcg",name:"HCG",category:"GLP-1 / Metabolic",icon:"💉",purpose:"Human Chorionic Gonadotropin; mimics LH to maintain testicular function during TRT or restart natural production.",benefits:["Maintains testicle size on TRT","Natural production restart","Fertility support"],protocol:{doseRange:"250-500 IU 2-3× weekly",defaultDoseMcg:500,timing:"Same days weekly",cycle:"Cycled / TRT support",cycleDays:84,route:"SubQ"},reconstitution:{typicalVialMg:0,defaultDiluentMl:5},synergy:["TRT","Kisspeptin-10"],avoid:["Excessive doses (estrogen)"],contraindications:["Hormone-sensitive cancers","Pregnancy"]},
  {id:"dihexa",name:"Dihexa",category:"Cognitive",icon:"🧠",purpose:"Hepatocyte growth factor analog; nootropic with strong synaptogenic effects.",benefits:["Synapse formation","Memory enhancement","Long-term potentiation"],protocol:{doseRange:"5-25 mg oral daily",defaultDoseMcg:5000,timing:"AM with food",cycle:"4-12 weeks",cycleDays:60,route:"Oral"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:["Cerebrolysin","Lion's Mane"],avoid:["No major issues"],contraindications:["Active malignancy (caution)","Pregnancy"]},
  {id:"ara-290",name:"ARA-290 (Cibinetide)",category:"Healing",icon:"🩹",purpose:"EPO-derived peptide for neuropathic pain and anti-inflammatory effects.",benefits:["Neuropathy relief","Anti-inflammatory","Tissue repair"],protocol:{doseRange:"4-16 mg daily",defaultDoseMcg:8000,timing:"Any time",cycle:"4-12 weeks",cycleDays:60,route:"SubQ"},reconstitution:{typicalVialMg:16,defaultDiluentMl:2},synergy:["BPC-157","TB-500"],avoid:["No major issues"],contraindications:["Pregnancy"]},
  {id:"pinealon",name:"Pinealon",category:"Cognitive",icon:"🌙",purpose:"Tripeptide bioregulator targeting pineal function and circadian rhythm.",benefits:["Cognitive support","Anti-aging","Circadian rhythm support"],protocol:{doseRange:"2-10 mg daily",defaultDoseMcg:5000,timing:"AM",cycle:"10-20 days · 3-6 mo break",cycleDays:14,route:"SubQ"},reconstitution:{typicalVialMg:10,defaultDiluentMl:2},synergy:["Epitalon","Selank"],avoid:["Continuous use beyond 20 days"],contraindications:["Pregnancy"]},
  {id:"aod9604",name:"AOD9604",category:"GH Secretagogue",icon:"🔥",purpose:"Modified GH fragment (176-191) for fat oxidation without IGF-1 elevation.",benefits:["Fat oxidation","Pre-workout","No IGF-1 effect"],protocol:{doseRange:"300-500 mcg pre-workout",defaultDoseMcg:400,timing:"AM fasted, pre-workout",cycle:"4-12 weeks",cycleDays:60,route:"SubQ"},reconstitution:{typicalVialMg:5,defaultDiluentMl:2},synergy:["Fasted cardio","HGH Frag"],avoid:["Eating immediately before/after"],contraindications:["Pregnancy"]},
  {id:"adamax",name:"Adamax",category:"Cognitive",icon:"🧠",purpose:"Russian short peptide bioregulator (Lys-Glu-Asp-Trp); cognitive and prostate support.",benefits:["Cognitive support","Prostate health","Bioregulation"],protocol:{doseRange:"1-2 mg daily",defaultDoseMcg:1500,timing:"AM",cycle:"10-20 days",cycleDays:14,route:"SubQ"},reconstitution:{typicalVialMg:10,defaultDiluentMl:2},synergy:["Pinealon","Selank"],avoid:["No major issues"],contraindications:["Pregnancy"]},
  {id:"wolverine",ingredients:{"bpc157":0.5,"tb500":0.5},name:"Wolverine (BPC + TB)",category:"Healing",icon:"🛡️",purpose:"Stack: BPC-157 + TB-500 for systemic recovery and tissue repair.",benefits:["Soft-tissue healing","Joint repair","Recovery"],protocol:{doseRange:"500 mcg daily",defaultDoseMcg:500,timing:"AM/PM",cycle:"4-6 weeks",cycleDays:35,route:"SubQ"},reconstitution:{typicalVialMg:20,defaultDiluentMl:2},synergy:["GHK-Cu"],avoid:["Continuous use"],contraindications:["Active malignancy"]},
  {id:"klow",ingredients:{"bpc157":0.125,"ghk-cu":0.625,"kpv":0.125,"tb500":0.125},name:"KLOW Stack (GHK/KPV/BPC/TB)",category:"Healing",icon:"💎",purpose:"Premium stack: GHK-Cu, KPV, BPC-157, TB-500 for skin/hair/tissue.",benefits:["Skin/hair","Tissue repair","Anti-inflammatory"],protocol:{doseRange:"~1 mL daily",defaultDoseMcg:2000,timing:"Evening",cycle:"30 days",cycleDays:30,route:"SubQ"},reconstitution:{typicalVialMg:80,defaultDiluentMl:5},synergy:["Microneedling"],avoid:["Wilson's disease"],contraindications:["Active malignancy"]},
  {id:"glow",ingredients:{"bpc157":0.143,"ghk-cu":0.714,"tb500":0.143},name:"GLOW Stack (GHK/BPC/TB)",category:"Healing",icon:"✨",purpose:"Stack: GHK-Cu + BPC-157 + TB-500 for skin glow and tissue repair.",benefits:["Skin elasticity","Tissue repair","Hair density"],protocol:{doseRange:"~1 mL daily",defaultDoseMcg:1500,timing:"Evening",cycle:"30 days",cycleDays:30,route:"SubQ"},reconstitution:{typicalVialMg:70,defaultDiluentMl:5},synergy:["Microneedling"],avoid:["Wilson's disease"],contraindications:["Active malignancy"]},
  {id:"fit",ingredients:{"cjc1295-no-dac":0.5,"ipamorelin":0.5},name:"FIT Stack (CJC + Ipa)",category:"GH Secretagogue",icon:"⚡",purpose:"Stack: CJC-1295 (no DAC) + Ipamorelin for pulsatile GH.",benefits:["GH pulse","Sleep","Recovery"],protocol:{doseRange:"200 mcg of each",defaultDoseMcg:200,timing:"Nighttime fasted",cycle:"5 on / 2 off · 8-12w",cycleDays:60,route:"SubQ"},reconstitution:{typicalVialMg:10,defaultDiluentMl:2},synergy:["Tesamorelin"],avoid:["Eating within 2h"],contraindications:["Active malignancy","Pregnancy"]},
  {id:"coremend",ingredients:{"bpc157":0.333,"kpv":0.333,"tb500":0.333},name:"Coremend Blend (KPV/BPC/TB)",category:"Healing",icon:"🩹",purpose:"Stack: KPV + BPC-157 + TB-500 for gut and tissue healing.",benefits:["Gut repair","Tissue healing","Anti-inflammatory"],protocol:{doseRange:"500 mcg daily",defaultDoseMcg:500,timing:"AM",cycle:"4-6 weeks",cycleDays:35,route:"SubQ"},reconstitution:{typicalVialMg:35,defaultDiluentMl:2},synergy:["GHK-Cu"],avoid:["Continuous use"],contraindications:["Active malignancy"]},
  {id:"pe-pin-sel",ingredients:{"pe-22-28":0.333,"pinealon":0.333,"selank":0.333},name:"PE-22-28 + Pinealon + Selank",category:"Cognitive",icon:"🧠",purpose:"Cognitive blend: PE-22-28 (focus) + Pinealon (circadian) + Selank (calm).",benefits:["Focus","Mood","Anti-anxiety","Circadian"],protocol:{doseRange:"500 mcg daily",defaultDoseMcg:500,timing:"AM, M-F",cycle:"4 weeks",cycleDays:28,route:"SubQ"},reconstitution:{typicalVialMg:30,defaultDiluentMl:3},synergy:["Cerebrolysin"],avoid:["Late-evening dosing"],contraindications:["Pregnancy"]},
  {id:"igf1-lr3",name:"IGF-1 LR3",category:"Anabolic",icon:"💪",purpose:"Long-acting IGF-1 analogue (~20-30h); direct anabolic signaling — muscle hyperplasia/hypertrophy, nutrient partitioning.",benefits:["Muscle growth","Recovery","Nutrient partitioning"],protocol:{doseRange:"20-50 mcg/day",defaultDoseMcg:40,timing:"AM or post-workout",cycle:"4 weeks on / 4+ off",cycleDays:28,route:"SubQ"},reconstitution:{typicalVialMg:1,defaultDiluentMl:2},synergy:["Tesamorelin","Testosterone"],avoid:["Dihexa (oncogenic synergy)","Continuous use"],contraindications:["Active/suspected malignancy","Family cancer history — surveil"]},
  {id:"lgd-4033",name:"LGD-4033 (Ligandrol)",category:"Anabolic",icon:"⚗️",purpose:"Oral SARM — selective androgen receptor agonist; muscle/strength with less androgenic effect than testosterone.",benefits:["Lean mass","Strength","Recomp"],protocol:{doseRange:"5-10 mg/day",defaultDoseMcg:5000,timing:"AM",cycle:"6-8 weeks",cycleDays:56,route:"Oral/Sublingual"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:["Testosterone"],avoid:["Stacking on already-high androgen load"],contraindications:["Hepatic concern (raises ALT/AST)","Crushes HDL — monitor lipids"]},
  {id:"j-147",name:"J-147",category:"Cognitive",icon:"🧠",purpose:"Curcumin-derived neuroprotective; targets mitochondrial ATP synthase, enhances neurogenesis. Strong Alzheimer's/aging preclinical data.",benefits:["Neuroprotection","Neurogenesis","Mitochondrial support","Cognitive"],protocol:{doseRange:"10-50 mg/day",defaultDoseMcg:10000,timing:"AM",cycle:"Ongoing",cycleDays:90,route:"Oral"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:["Mitochondrial peptides"],avoid:[],contraindications:["Limited human data"]},
  {id:"atx-304",name:"ATX-304",category:"Metabolic",icon:"🔥",purpose:"Direct pan-AMPK activator (oral); fat oxidation, insulin sensitivity, mitochondrial signaling — exercise mimetic.",benefits:["Fat oxidation","Insulin sensitivity","Metabolic"],protocol:{doseRange:"25-50 mg/day",defaultDoseMcg:25000,timing:"AM",cycle:"Ongoing",cycleDays:60,route:"Oral"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:[],avoid:["MOTS-c (AMPK overlap — redundant)"],contraindications:["Experimental"]},
  {id:"flrg242",name:"FLRG242",category:"Anabolic",icon:"💪",purpose:"Follistatin-based myostatin inhibitor; muscle growth via myostatin/activin neutralization. More selective than ActRIIB traps (skips BMP9/10 vascular toxicity).",benefits:["Muscle growth","Recomp"],protocol:{doseRange:"100 mcg/day or 5mg q2wk",defaultDoseMcg:100,timing:"AM",cycle:"20-30 days",cycleDays:30,route:"SubQ"},reconstitution:{typicalVialMg:5,defaultDiluentMl:1},synergy:["Testosterone","IGF-1"],avoid:["ACE-031 (additive myostatin/activin)"],contraindications:["Experimental","Suppresses FSH"]},
  {id:"melanotan1",name:"Melanotan I",category:"Other",icon:"☀️",purpose:"MC1R-selective melanocortin — tanning + UV photoprotection via melanin. Minimal MC4R (little libido/nausea vs MT-2).",benefits:["Tanning","Photoprotection"],protocol:{doseRange:"250-500 mcg/day load",defaultDoseMcg:250,timing:"Any",cycle:"Load then maintain",cycleDays:30,route:"SubQ"},reconstitution:{typicalVialMg:10,defaultDiluentMl:2},synergy:[],avoid:[],contraindications:["Darkens moles — melanoma surveillance"]},
  {id:"orexin-a",name:"Orexin-A",category:"Cognitive",icon:"⚡",purpose:"Wakefulness/arousal neuropeptide (intranasal); daytime alertness, focus, mood.",benefits:["Wakefulness","Alertness","Focus"],protocol:{doseRange:"PRN intranasal",defaultDoseMcg:0,timing:"AM only",cycle:"PRN",cycleDays:30,route:"Intranasal"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:[],avoid:["Afternoon/evening dosing (fragments sleep)"],contraindications:["Sleep disorders — time carefully"]},
  {id:"noopept",name:"Noopept",category:"Cognitive",icon:"🧠",purpose:"Fast-acting nootropic (intranasal); raises BDNF/NGF, focus and memory.",benefits:["Focus","Memory","Neuroprotection"],protocol:{doseRange:"PRN intranasal",defaultDoseMcg:0,timing:"AM",cycle:"Cycle (TrkB hedge)",cycleDays:28,route:"Intranasal"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:[],avoid:["Continuous use (cycle for TrkB)"],contraindications:[]},
  {id:"adalank",name:"Adalank",category:"Cognitive",icon:"🌊",purpose:"Selank-type anxiolytic analogue (intranasal); calm, immune, mild cognitive.",benefits:["Anti-anxiety","Calm","Immune"],protocol:{doseRange:"PRN intranasal",defaultDoseMcg:0,timing:"AM",cycle:"Cycle",cycleDays:28,route:"Intranasal"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:[],avoid:[],contraindications:[]},
  {id:"neurolux",ingredients:{"semax":0.42,"selank":0.17,"pinealon":0.21,"pe-22-28":0.21},name:"Neurolux (Semax+Selank+Pinealon+PE22-28)",category:"Cognitive",icon:"🧠",purpose:"Comprehensive cognitive blend: N-Acetyl-Semax 20mg + N-Acetyl-Selank 8mg + Pinealon 10mg + PE22-28 10mg. Focus + calm + circadian in one.",benefits:["Focus","Mood","Anti-anxiety","Circadian","Neuroprotection"],protocol:{doseRange:"~12u/day",defaultDoseMcg:500,timing:"AM",cycle:"4 on / 2-4 off (TrkB hedge)",cycleDays:28,route:"SubQ"},reconstitution:{typicalVialMg:48,defaultDiluentMl:4.8},synergy:[],avoid:["Running continuously (cycle for TrkB)"],contraindications:["Pregnancy"]},
  {id:"tadalafil",name:"Tadalafil",category:"Other",icon:"❤️",purpose:"PDE5 inhibitor; vascular/endothelial benefit, erectile function, BPH. Low-dose daily.",benefits:["Vascular","Erectile","Endothelial","BPH"],protocol:{doseRange:"2.5-5 mg/day",defaultDoseMcg:2500,timing:"Daily",cycle:"Ongoing",cycleDays:365,route:"Sublingual/Oral"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:[],avoid:["Nitrates"],contraindications:["Nitrate use","Severe cardiovascular disease"]},
  {id:"anastrozole",name:"Anastrozole",category:"Hormone",icon:"🚫",purpose:"Aromatase inhibitor — blocks testosterone→estradiol conversion. Manages high E2 on TRT.",benefits:["E2 control"],protocol:{doseRange:"0.125-0.5 mg, 1-2x/wk",defaultDoseMcg:250,timing:"PRN to labs",cycle:"As needed",cycleDays:365,route:"Sublingual/Oral"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:["Testosterone"],avoid:["Prophylactic use","Over-suppression"],contraindications:["Low E2 (<20 — joint/bone/lipid harm)","Use sensitive E2 assay"]},
  {id:"testosterone",name:"Testosterone",category:"Hormone",icon:"⚡",oil:true,purpose:"Primary androgen — anabolic/androgenic baseline. TRT foundation.",benefits:["Muscle","Libido","Mood","Energy","Bone"],protocol:{doseRange:"15-25 mg/day SubQ",defaultDoseMcg:20000,timing:"Daily AM",cycle:"Ongoing",cycleDays:365,route:"SubQ"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:["HCG (always)","Anastrozole (if needed)"],avoid:["TRT without HCG"],contraindications:["Polycythemia (monitor HCT)","Prostate cancer"]},
  {id:"finasteride",name:"Finasteride",category:"Other",icon:"💊",purpose:"5α-reductase inhibitor — blocks T→DHT. Hair-loss Rx.",benefits:["Hair preservation"],protocol:{doseRange:"1 mg/day (or topical)",defaultDoseMcg:1000,timing:"Daily",cycle:"Ongoing",cycleDays:365,route:"Oral"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:[],avoid:[],contraindications:["Watch libido/mood/sleep (allopregnanolone). Topical spares systemic."]},
  {id:"9-me-bc",name:"9-Me-BC",category:"Cognitive",icon:"🧠",purpose:"Dopaminergic/neurogenic nootropic; dopamine receptor sensitization, neuroprotection.",benefits:["Dopaminergic","Neurogenesis","Mood"],protocol:{doseRange:"5-20 mg/day",defaultDoseMcg:20000,timing:"AM",cycle:"Short cycles",cycleDays:14,route:"Oral"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:[],avoid:["SSRIs/MAOIs (serotonin syndrome risk)"],contraindications:["Concurrent serotonergics (e.g. sertraline)"]},
  {id:"l-carnitine",name:"L-Carnitine",category:"Metabolic",icon:"🔥",purpose:"Mitochondrial fatty-acid transport; fat oxidation, energy. (ALCAR variant crosses BBB for cognition.)",benefits:["Fat oxidation","Energy","Recovery"],protocol:{doseRange:"500-2000 mg",defaultDoseMcg:1000000,timing:"Pre-workout/AM",cycle:"Ongoing",cycleDays:365,route:"SubQ/IM"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:[],avoid:["High-dose oral (TMAO via gut FMO3 — injectable/ALCAR preferred)"],contraindications:["Seizure history"]},
  {id:"l-glutathione",name:"L-Glutathione",category:"Other",icon:"🛡️",purpose:"Master antioxidant; detox, immune, skin. Note: SubQ/IM largely degraded by γ-GT — IV is the effective route.",benefits:["Antioxidant","Detox","Skin","Immune"],protocol:{doseRange:"600-1200 mg",defaultDoseMcg:1200000,timing:"2-3x/wk",cycle:"Ongoing",cycleDays:365,route:"IV (best) / SubQ-IM (low yield)"},reconstitution:{typicalVialMg:1200,defaultDiluentMl:3},synergy:["NAC","Glycine","Vitamin C"],avoid:["SubQ/IM expecting IV-level delivery"],contraindications:[]},
  // ── Androgens / AAS. `oil:true` = pre-mixed oil vial: no reconstitution, the vial IS the
  // concentration (total mg in total mL). reconstitution.typicalVialMg/defaultDiluentMl describe a
  // standard 10 mL vial so the draw calculator still prefills (e.g. 2000 mg / 10 mL = 200 mg/mL).
  {id:"anavar",name:"Anavar (Oxandrolone)",category:"Anabolic",icon:"💊",purpose:"Oral 17α-alkylated anabolic steroid with a high anabolic-to-androgenic ratio; does not aromatize, minimal water retention.",benefits:["Lean mass and strength","Hardness without bloat","Well-tolerated oral"],protocol:{doseRange:"20–50 mg/day (often split AM/PM)",defaultDoseMcg:50000,timing:"AM, or split AM/PM",cycle:"6–8 weeks",cycleDays:42,route:"Oral"},reconstitution:{typicalVialMg:0,defaultDiluentMl:0},synergy:["Testosterone base","Liver support (TUDCA / NAC)"],avoid:["Other 17α-alkylated orals at the same time","Alcohol"],contraindications:["Hepatic strain — ALT/AST","Crushes HDL — monitor lipids","Prostate cancer"]},
  {id:"deca",name:"Deca (Nandrolone Decanoate)",category:"Anabolic",icon:"💉",oil:true,purpose:"Long-ester injectable nandrolone (~6–8 day half-life): strong anabolic signal, joint/connective-tissue comfort, low aromatization but progestogenic.",benefits:["Mass and strength","Joint comfort","Collagen synthesis"],protocol:{doseRange:"100–400 mg/week (1–2 shots)",defaultDoseMcg:200000,timing:"Same day(s) weekly",cycle:"10–16 weeks",cycleDays:84,route:"IM"},reconstitution:{typicalVialMg:2000,defaultDiluentMl:10},synergy:["Testosterone (always a T base)","HCG"],avoid:["Running without testosterone","Other 19-nors (NPP/Tren) concurrently"],contraindications:["Prolactin / libido suppression","Polycythemia — monitor HCT","Prostate cancer"]},
  {id:"npp",name:"NPP (Nandrolone Phenylpropionate)",category:"Anabolic",icon:"💉",oil:true,purpose:"Short-ester nandrolone (~2–3 day half-life): Deca's anabolic and joint profile with faster clearance and tighter dose control.",benefits:["Mass and strength","Joint comfort","Fast on / fast off"],protocol:{doseRange:"50–100 mg every other day",defaultDoseMcg:100000,timing:"EOD or Mon/Wed/Fri",cycle:"8–12 weeks",cycleDays:70,route:"IM"},reconstitution:{typicalVialMg:1000,defaultDiluentMl:10},synergy:["Testosterone base","HCG"],avoid:["Running without testosterone","Deca at the same time"],contraindications:["Prolactin / libido suppression","Polycythemia — monitor HCT","Prostate cancer"]},
  {id:"primobolan",name:"Primobolan (Methenolone Enanthate)",category:"Anabolic",icon:"💉",oil:true,purpose:"DHT-derived injectable: mild, non-aromatizing lean-tissue and hardening agent with a low side-effect profile.",benefits:["Lean tissue retention","No aromatization / water","Gentle on blood pressure"],protocol:{doseRange:"300–600 mg/week (2 shots)",defaultDoseMcg:300000,timing:"2×/week",cycle:"10–16 weeks",cycleDays:84,route:"IM"},reconstitution:{typicalVialMg:1000,defaultDiluentMl:10},synergy:["Testosterone base","Anavar (dry stack)"],avoid:["Expecting fast mass gains"],contraindications:["Hair loss (DHT-derived)","Lipid shifts — monitor","Prostate cancer"]},
  {id:"testosterone-cypionate",name:"Testosterone Cypionate",category:"Hormone",icon:"⚡",oil:true,purpose:"Long-ester testosterone (~5–8 day half-life); TRT and cycle foundation. Small daily / EOD SubQ shots give the steadiest levels.",benefits:["Muscle","Libido","Mood","Energy","Bone"],protocol:{doseRange:"20 mg/day SubQ · 100–200 mg/week TRT",defaultDoseMcg:20000,timing:"Daily AM or split 2×/week",cycle:"Ongoing",cycleDays:365,route:"SubQ or IM"},reconstitution:{typicalVialMg:2000,defaultDiluentMl:10},synergy:["HCG (always)","Anastrozole only if E2 runs high"],avoid:["TRT without HCG","Skipping bloodwork"],contraindications:["Polycythemia (monitor HCT)","Prostate cancer","Untreated sleep apnea"]},
  {id:"testosterone-enanthate",name:"Testosterone Enanthate",category:"Hormone",icon:"⚡",oil:true,purpose:"Long-ester testosterone (~4–5 day half-life); interchangeable with cypionate for TRT and cycles. Injected 1–2×/week or in small daily shots.",benefits:["Muscle","Libido","Mood","Energy","Bone"],protocol:{doseRange:"100–200 mg/week TRT · 250–500 mg/week cycle",defaultDoseMcg:100000,timing:"Split 2×/week or daily SubQ",cycle:"Ongoing / 12–16 weeks",cycleDays:365,route:"SubQ or IM"},reconstitution:{typicalVialMg:2500,defaultDiluentMl:10},synergy:["HCG (always)","Anastrozole only if E2 runs high"],avoid:["TRT without HCG","Skipping bloodwork"],contraindications:["Polycythemia (monitor HCT)","Prostate cancer","Untreated sleep apnea"]},
];
const isOilPep = (pid) => { const p = findPep(pid); return !!(p && p.oil); };

const CATEGORIES = [...new Set(PEPTIDE_DB.map(p => p.category))].sort();
const PROFILES = ['Roman', 'Scott', 'Jamal', 'Tim'];
const SEPARATE_INVENTORY_PROFILES = ['Tim']; // these profiles have their own storage/vials, others share

const STACK_TEMPLATES = [
  { id: "recovery", name: "Recovery Stack", icon: "🩹", peptides: ["bpc157","tb500"], description: "Synergistic soft-tissue and joint healing", duration: "4-6 weeks" },
  { id: "growth", name: "GH Optimization", icon: "💤", peptides: ["ipamorelin","cjc1295-no-dac"], description: "Pulsatile GH release, sleep & recomp", duration: "8-12 weeks" },
  { id: "cognitive", name: "Cognitive Stack", icon: "🧠", peptides: ["semax","selank"], description: "Focus AM, calm focus PM", duration: "10-14 days" },
  { id: "longevity", name: "Longevity Protocol", icon: "⏳", peptides: ["epitalon","mots-c"], description: "Telomere + mitochondrial support", duration: "Cycled" },
  { id: "fat-loss", name: "Fat Loss Stack", icon: "📉", peptides: ["tesamorelin","ipamorelin"], description: "Visceral fat reduction with GH pulse", duration: "8-12 weeks" },
  { id: "skin-hair", name: "Skin & Hair", icon: "💎", peptides: ["ghk-cu","tb500"], description: "Collagen, density, regeneration", duration: "30-60 days" },
];

const uid = () => Date.now().toString(36) + Math.floor(Math.random() * 9999).toString(36);
const fmtDate = (ts) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const fmtDateTime = (ts) => { const d = new Date(ts); return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`; };
const todayLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const fmtMcg = (n) => { if (n == null || isNaN(n)) return '—'; if (n >= 1000) return (n / 1000).toFixed(2).replace(/\.?0+$/, '') + ' mg'; return Math.round(n) + ' mcg'; };
// IU-aware dose formatting. For IU vials the stored mcg-number IS the IU value (1 mcg-unit ≡ 1 IU proxy).
const fmtIU = (n) => { if (n == null || isNaN(n)) return '—'; return Math.round(n).toLocaleString() + ' IU'; };
const isIUVial = (v) => !!(v && v.unitLabel === 'IU');
const fmtDoseUnit = (n, v) => isIUVial(v) ? fmtIU(n) : fmtMcg(n);
const doseUnitLabel = (v) => isIUVial(v) ? 'IU' : 'mcg';
// Build the {doseUnit, doseValue} display/sync tag for a protocol from its chosen unit + canonical mcg.
// Returns nulls for the mcg default so the worker keeps its nice magnitude fallback (e.g. 100000 -> "100mg").
const doseUnitTag = (unit, doseMcg) => {
  if (!unit || unit === 'mcg' || doseMcg == null || isNaN(doseMcg)) return { doseUnit: null, doseValue: null };
  if (unit === 'IU') return { doseUnit: 'IU', doseValue: doseMcg };       // IU proxy: stored mcg-number IS the IU value
  if (unit === 'g')  return { doseUnit: 'g',  doseValue: doseMcg / 1e6 };
  if (unit === 'mg') return { doseUnit: 'mg', doseValue: doseMcg / 1000 };
  return { doseUnit: null, doseValue: null };
};
// ── dose canonicalization (KEEP BYTE-IDENTICAL with worker.js + test_dose_canon.js) ──────────
// doseMcg is the single source of truth all syringe/reconstitution math reads. The display tags
// doseUnit/doseValue are DERIVED from it here so a synced/imported payload can never make Claude
// show one number while the app draws another. Inconsistent/unsupported tags are dropped.
function canonicalizeDose(o) {
  if (!o || typeof o !== 'object') return o;
  const m = Number(o.doseMcg);
  const tagged = (o.doseUnit != null || o.doseValue != null);
  if (!Number.isFinite(m) || m <= 0) return tagged ? { ...o, doseUnit: null, doseValue: null } : o;
  let dv;
  if (o.doseUnit === 'mg') dv = m / 1000;
  else if (o.doseUnit === 'g') dv = m / 1e6;
  else if (o.doseUnit === 'IU') dv = m;            // IU proxy: the stored mcg-number IS the IU value
  else return tagged ? { ...o, doseUnit: null, doseValue: null } : o; // mcg default / unknown unit → no tag
  return (o.doseValue === dv) ? o : { ...o, doseValue: dv };          // derive display value FROM doseMcg
}
function canonicalizeState(state) {
  if (!state || typeof state !== 'object') return state;
  const out = { ...state };
  if (Array.isArray(state.protocols)) out.protocols = state.protocols.map(canonicalizeDose);
  if (Array.isArray(state.logs)) out.logs = state.logs.map(canonicalizeDose);
  return out;
}
const fmtMoney = (n) => n == null ? '—' : '$' + Number(n).toFixed(2);
const findPep = (id) => PEPTIDE_DB.find(p => p.id === id);

// ===== DOSE-GATE-BEGIN (portable; Node + browser) =====
// CP2 dose-sanity gate. Pure, no DOM, no network. Copy this marker block
// verbatim into the HTML app. Everything it needs is defined between the
// markers (DEFAULT_CEILINGS + helpers + evaluateDose). Do NOT reference
// `module`, `require`, or `process` inside the markers.
//
// ponytail: IU assumption. The app stores an HCG dose of 250 (meaning 250 IU)
// in the same numeric `doseMcg` field it uses for mcg compounds. So for HCG
// (and any IU compound) we treat the incoming `doseMcg` number AS the IU value
// directly — no mcg conversion. Ceilings for IU compounds are compared against
// that same raw number. Only mg gets a real ×1000 conversion to mcg.

var DEFAULT_CEILINGS = {
  tadalafil:      { maxMcg: 20 * 1000, per: "dose", unit: "mg" },
  testosterone:   { maxMcg: 50 * 1000, per: "dose", unit: "mg" },
  trt:            { maxMcg: 50 * 1000, per: "dose", unit: "mg" },
  "test-cyp":     { maxMcg: 50 * 1000, per: "dose", unit: "mg" },
  // Oil-based AAS + oral: generous per-shot caps that only catch magnitude slips (mg typed as g, etc.)
  "testosterone-cypionate":  { maxMcg: 500 * 1000, per: "dose", unit: "mg" },
  "testosterone-enanthate":  { maxMcg: 500 * 1000, per: "dose", unit: "mg" },
  anavar:         { maxMcg: 100 * 1000, per: "dose", unit: "mg" },
  deca:           { maxMcg: 400 * 1000, per: "dose", unit: "mg" },
  npp:            { maxMcg: 200 * 1000, per: "dose", unit: "mg" },
  primobolan:     { maxMcg: 400 * 1000, per: "dose", unit: "mg" },
  hcg:            { maxMcg: 1500,      per: "dose", unit: "IU" },   // raw IU number
  retatrutide:    { maxMcg: 12 * 1000, per: "week", unit: "mg" },
  cagrilintide:   { maxMcg: 5 * 1000,  per: "dose", unit: "mg" },
  // GH secretagogues: 2000 mcg per dose
  ipamorelin:     { maxMcg: 2000, per: "dose", unit: "mcg" },
  "cjc1295-no-dac": { maxMcg: 2000, per: "dose", unit: "mcg" },
  "cjc1295-dac":  { maxMcg: 2000, per: "dose", unit: "mcg" },
  tesamorelin:    { maxMcg: 2000, per: "dose", unit: "mcg" },
  sermorelin:     { maxMcg: 2000, per: "dose", unit: "mcg" },
  hexarelin:      { maxMcg: 2000, per: "dose", unit: "mcg" },
  ghrp:           { maxMcg: 2000, per: "dose", unit: "mcg" },
  "ipa-cjc":      { maxMcg: 2000, per: "dose", unit: "mcg" }
};

// Convert a mass to mcg. mg → ×1000. mcg → as-is. IU → treated as raw numeric
// (see ponytail note above): NOT converted, returned as-is so it can be
// compared to an IU ceiling stored as a raw number.
function toMcg(value, unit) {
  if (value == null || isNaN(value)) return NaN;
  if (unit === "mg") return value * 1000;
  return value; // mcg, IU, or null-unit: numeric as stored
}

// Look up the ceiling entry for a peptide by id or name (case-insensitive).
function findCeiling(ceilings, peptideId, peptideName) {
  if (!ceilings) return null;
  var keys = [peptideId, peptideName];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k == null) continue;
    var lc = String(k).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(ceilings, lc)) return ceilings[lc];
  }
  return null;
}

// Pretty-print a mass in its natural unit for messages.
function fmtMass(mcg, unit) {
  if (mcg == null || isNaN(mcg)) return "?";
  if (unit === "mg") return round2(mcg / 1000) + " mg";
  if (unit === "IU") return round2(mcg) + " IU";
  return round2(mcg) + " mcg";
}
function round2(n) { return Math.round(n * 100) / 100; }

// ---- the gate ----
function evaluateDose(input, context) {
  input = input || {};
  context = context || {};
  var ceilings = context.ceilings || DEFAULT_CEILINGS;

  var reasons = [];
  var blocked = false;

  var doseMcg = input.doseMcg;          // already normalized to mcg by caller (mg×1000), or raw IU for IU compounds
  var freq = input.frequencyPerWeek;
  var priorDoseMcg = (context.priorDoseMcg == null) ? null : context.priorDoseMcg;

  // Natural display unit: prefer the compound's ceiling unit, else the entered unit, else mcg.
  var ceiling = findCeiling(ceilings, input.peptideId, input.peptideName);
  var displayUnit = (ceiling && ceiling.unit) || input.doseUnit || "mcg";
  var isIU = displayUnit === "IU" || input.doseUnit === "IU" || (ceiling && ceiling.unit === "IU");

  // Implied totals (computed even when blocked, except when non-numeric).
  var validNum = (doseMcg != null && !isNaN(doseMcg) && doseMcg > 0);
  var impliedPerDoseMcg = validNum ? doseMcg : null;
  var impliedDailyMcg = (validNum && typeof freq === "number") ? doseMcg * (freq / 7) : null;
  var impliedWeeklyMcg = (validNum && typeof freq === "number") ? doseMcg * freq : null;

  // ---- HARD BLOCK checks (collect all reasons; any → BLOCK) ----

  // 1. missing/invalid dose
  if (doseMcg == null || isNaN(doseMcg) || doseMcg <= 0) {
    reasons.push("missing/invalid dose");
    blocked = true;
  }

  // 2. volume-as-mass
  if (input.enteredAsVolume === true) {
    reasons.push("volume-as-mass — enter a mass in mcg/mg");
    blocked = true;
  }

  // 3. unknown / first-time compound (includes PRN with no prior)
  if (!context.knownCompound) {
    reasons.push("unknown/first-time compound — needs Claude review");
    blocked = true;
  }

  // 4. unit change vs priorUnit
  if (context.priorUnit && input.doseUnit && context.priorUnit !== input.doseUnit) {
    reasons.push("unit change (" + context.priorUnit + "→" + input.doseUnit + ") — magnitude risk");
    blocked = true;
  }

  // 5. ≥5× prior dose (per-dose)
  if (priorDoseMcg != null && !isNaN(priorDoseMcg) && priorDoseMcg > 0 && validNum && doseMcg >= 5 * priorDoseMcg) {
    reasons.push("≥5× prior dose (" + fmtMass(priorDoseMcg, displayUnit) + "→" + fmtMass(doseMcg, displayUnit) + ")");
    blocked = true;
  }

  // 6. ceiling breach (compared in mcg-equivalent; IU compared as raw number)
  if (ceiling && ceiling.maxMcg != null) {
    var compareVal = (ceiling.per === "week") ? impliedWeeklyMcg : impliedPerDoseMcg;
    if (compareVal != null && !isNaN(compareVal) && compareVal > ceiling.maxMcg) {
      var perLabel = ceiling.per === "week" ? "/week" : "/dose";
      reasons.push("exceeds ceiling (" + fmtMass(compareVal, ceiling.unit) + " > " + fmtMass(ceiling.maxMcg, ceiling.unit) + perLabel + ")");
      blocked = true;
    }
  }

  // 7. ≥5× weekly exposure (catches frequency multiplication with per-dose unchanged)
  var priorFreq = context.priorFrequencyPerWeek;
  if (priorDoseMcg != null && !isNaN(priorDoseMcg) && priorDoseMcg > 0 &&
      typeof priorFreq === "number" && priorFreq > 0 &&
      impliedWeeklyMcg != null && !isNaN(impliedWeeklyMcg)) {
    var priorWeekly = priorDoseMcg * priorFreq;
    if (priorWeekly > 0 && impliedWeeklyMcg >= 5 * priorWeekly) {
      reasons.push("≥5× weekly exposure (freq change: " + fmtMass(priorWeekly, displayUnit) + "/wk→" + fmtMass(impliedWeeklyMcg, displayUnit) + "/wk)");
      blocked = true;
    }
  }

  if (blocked) {
    return {
      decision: "BLOCK",
      reasons: reasons,
      impliedPerDoseMcg: impliedPerDoseMcg,
      impliedDailyMcg: impliedDailyMcg,
      impliedWeeklyMcg: impliedWeeklyMcg,
      message: buildMessage("BLOCK", input, context, {
        impliedPerDoseMcg: impliedPerDoseMcg,
        impliedWeeklyMcg: impliedWeeklyMcg,
        displayUnit: displayUnit,
        reasons: reasons
      })
    };
  }

  // ---- PASS: scheduled check-off that matches protocol exactly ----
  if (input.isScheduledCheckoff === true &&
      context.scheduledDoseMcg != null &&
      doseMcg === context.scheduledDoseMcg) {
    reasons.push("scheduled check-off matches protocol");
    return {
      decision: "PASS",
      reasons: reasons,
      impliedPerDoseMcg: impliedPerDoseMcg,
      impliedDailyMcg: impliedDailyMcg,
      impliedWeeklyMcg: impliedWeeklyMcg,
      message: buildMessage("PASS", input, context, {
        impliedPerDoseMcg: impliedPerDoseMcg,
        impliedWeeklyMcg: impliedWeeklyMcg,
        displayUnit: displayUnit,
        reasons: reasons
      })
    };
  }

  // ---- CONFIRM: known compound, no block, but a change or off-schedule shot ----
  // Describe the change for the reason list.
  if (priorDoseMcg != null && !isNaN(priorDoseMcg) && validNum && doseMcg !== priorDoseMcg) {
    if (doseMcg > priorDoseMcg) {
      reasons.push("dose increase (" + fmtMass(priorDoseMcg, displayUnit) + "→" + fmtMass(doseMcg, displayUnit) + ")");
    } else {
      reasons.push("dose decrease (" + fmtMass(priorDoseMcg, displayUnit) + "→" + fmtMass(doseMcg, displayUnit) + ")");
    }
  }
  if (typeof priorFreq === "number" && typeof freq === "number" && freq !== priorFreq) {
    reasons.push("frequency change (" + priorFreq + "→" + freq + "×/wk)");
  }
  if (context.priorRoute && input.route && context.priorRoute !== input.route) {
    reasons.push("route change (" + context.priorRoute + "→" + input.route + ")");
  }
  if (input.isScheduledCheckoff !== true) {
    reasons.push("ad-hoc off-schedule dose");
  }
  if (reasons.length === 0) {
    reasons.push("dose change — confirm before logging");
  }

  return {
    decision: "CONFIRM",
    reasons: reasons,
    impliedPerDoseMcg: impliedPerDoseMcg,
    impliedDailyMcg: impliedDailyMcg,
    impliedWeeklyMcg: impliedWeeklyMcg,
    needsReview: true,
    message: buildMessage("CONFIRM", input, context, {
      impliedPerDoseMcg: impliedPerDoseMcg,
      impliedWeeklyMcg: impliedWeeklyMcg,
      displayUnit: displayUnit,
      reasons: reasons
    })
  };
}

// Human-readable message. Echoes per-dose + weekly totals in natural units.
function buildMessage(decision, input, context, x) {
  var name = input.peptideName || input.peptideId || "compound";
  var unit = x.displayUnit;
  var route = input.route ? " " + routeLabel(input.route) : "";
  var freqLabel = freqToLabel(input.frequencyPerWeek);

  if (decision === "BLOCK") {
    // Lead with the strongest human-legible reason.
    var lead = x.reasons[0] || "invalid dose";
    var body = "BLOCKED — " + name + ": " + x.reasons.join("; ") + ".";
    if (x.impliedPerDoseMcg != null) {
      body += " Entered ≈ " + fmtMass(x.impliedPerDoseMcg, unit);
      if (x.impliedWeeklyMcg != null) body += ", " + fmtMass(x.impliedWeeklyMcg, unit) + "/week";
      body += ".";
    }
    body += " Re-enter the intended dose or finish in Claude.";
    return body;
  }

  var totals = fmtMass(x.impliedPerDoseMcg, unit) + "/dose";
  if (x.impliedWeeklyMcg != null) totals += ", " + fmtMass(x.impliedWeeklyMcg, unit) + "/week";

  if (decision === "PASS") {
    return "OK — " + name + " " + fmtMass(x.impliedPerDoseMcg, unit) + route +
           (freqLabel ? " " + freqLabel : "") + " ≈ " + totals + ". Matches protocol; logged.";
  }

  // CONFIRM
  var changeNote = "";
  for (var i = 0; i < x.reasons.length; i++) {
    if (x.reasons[i].indexOf("increase") === 0 || x.reasons[i].indexOf("decrease") === 0 ||
        x.reasons[i].indexOf("frequency") === 0 || x.reasons[i].indexOf("route") === 0) {
      changeNote = " " + capitalize(x.reasons[i]) + ".";
      break;
    }
  }
  return "CONFIRM — " + name + " " + fmtMass(x.impliedPerDoseMcg, unit) + route +
         (freqLabel ? " " + freqLabel : "") + " ≈ " + totals + "." + changeNote +
         " Tap Yes to log; flagged for review.";
}

function routeLabel(r) {
  var m = { inj: "IM", subq: "SubQ", im: "IM", oral: "oral", sublingual: "SL" };
  return m[r] || r;
}
function freqToLabel(f) {
  if (typeof f !== "number") return "";
  if (f === 7) return "daily";
  if (f === 1) return "weekly";
  if (Math.abs(f - 3.5) < 0.01) return "EOD";
  return f + "×/wk";
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
// ===== DOSE-GATE-END =====

// ===== SCHEDULE-ENGINE-BEGIN (portable; Node + browser) =====
// Everything that decides WHEN a protocol is due lives here, in one place, so the header ring,
// the week strip, the day list, the cards and the adherence export can never disagree.
//
// Protocol shape (all additive; every field below is optional and legacy readers keep working):
//   schedule: { days:[0..6], timeOfDay, every?:N, anchor?:'YYYY-MM-DD' }
//             every>1 = interval schedule ("every other day" = 2) counted from `anchor`
//             (a day the dose IS due). `days` is still written — mirrored to the weekdays due in
//             the next 7 days — so the sync worker / CLI (which only read `days`) stay right.
//   startDate / endDate: the protocol only appears on dates inside [startDate, endDate].
//             "Finish cycle" sets endDate; the compound vanishes from later dates, history stays.
//   timeline: [{ id, from:'YYYY-MM-DD'|null, schedule, doseMcg, doseUnit, doseValue }]
//             schedule/dose REVISIONS with effective dates (past or future). from:null is the
//             original plan. The base fields always mirror the entry effective TODAY
//             (see materializeProto), so anything reading only p.schedule/p.doseMcg is correct
//             for today without knowing about timelines.
// Date keys ('dk') are local calendar days as 'YYYY-MM-DD' strings; arithmetic runs at UTC noon
// so DST transitions can never shift a day.
var DAY_MS = 86400000;
var ALL_DAYS = [0,1,2,3,4,5,6];
var TIMELINE_FIELDS = ['schedule','doseMcg','doseUnit','doseValue'];
function pad2(n) { return String(n).padStart(2, '0'); }
function dkParse(dk) {
  if (!dk || typeof dk !== 'string') return NaN;
  var p = dk.slice(0, 10).split('-'); if (p.length < 3) return NaN;
  var t = Date.UTC(+p[0], +p[1] - 1, +p[2], 12); return isNaN(t) ? NaN : t;
}
function dkFromUTC(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
function dkFromLocalDate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function dkToday() { return dkFromLocalDate(new Date()); }
function dkAdd(dk, n) { var t = dkParse(dk); return isNaN(t) ? dk : dkFromUTC(t + n * DAY_MS); }
function dkDiff(a, b) { return Math.round((dkParse(a) - dkParse(b)) / DAY_MS); }   // a − b, in days
function dkDow(dk) { return new Date(dkParse(dk)).getUTCDay(); }
function dkValid(dk) { return !isNaN(dkParse(dk)); }
function dkOf(v) { return (v == null) ? null : String(v).slice(0, 10); }          // ISO datetime → dk
function arrEq(a, b) { a = a || []; b = b || []; if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
// Normalize a schedule object: interval schedules carry every>1 (+anchor); otherwise a day set.
function normSched(s, fallbackAnchor) {
  s = s || {};
  var every = (+s.every > 1) ? Math.round(+s.every) : null;
  var days = Array.isArray(s.days) ? s.days.map(Number).filter(function(d){ return d >= 0 && d <= 6; }).sort() : ALL_DAYS.slice();
  var out = { days: every ? ALL_DAYS.slice() : days, timeOfDay: s.timeOfDay || 'morning' };
  if (every) { out.every = every; out.anchor = dkValid(s.anchor) ? dkOf(s.anchor) : (dkValid(fallbackAnchor) ? dkOf(fallbackAnchor) : dkToday()); }
  return out;
}
function schedEq(a, b) {
  a = a || {}; b = b || {};
  var ia = +a.every > 1, ib = +b.every > 1;
  if (ia !== ib) return false;
  if ((a.timeOfDay || 'morning') !== (b.timeOfDay || 'morning')) return false;
  if (ia) return +a.every === +b.every && dkOf(a.anchor) === dkOf(b.anchor);
  return arrEq(a.days || ALL_DAYS, b.days || ALL_DAYS);
}
function isPrnSched(s) { var d = s && s.days; return !(s && +s.every > 1) && Array.isArray(d) && d.length === 0; }
// Doses per week implied by a schedule (gate context + labels).
function freqPerWeek(s) { if (!s) return 7; if (+s.every > 1) return 7 / +s.every; var d = s.days || ALL_DAYS; return d.length || null; }
// Human label. short=true for tile footers.
function schedLabel(s, short) {
  s = s || {};
  if (+s.every > 1) return +s.every === 2 ? (short ? 'EOD' : 'Every other day') : (short ? 'q' + s.every + 'd' : 'Every ' + s.every + ' days');
  var d = s.days || ALL_DAYS;
  if (d.length === 7) return 'Daily';
  if (d.length === 0) return 'As needed';
  if (d.length === 5 && [1,2,3,4,5].every(function(x){ return d.indexOf(x) >= 0; })) return short ? 'Wkdys' : 'Weekdays';
  var L = short ? ['S','M','T','W','T','F','S'] : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return d.map(function(x){ return L[x]; }).join(short ? '' : '/');
}
function timelineSorted(tl) {
  return (tl || []).slice().sort(function(a, b) {
    if (a.from == null && b.from == null) return 0; if (a.from == null) return -1; if (b.from == null) return 1;
    return a.from < b.from ? -1 : a.from > b.from ? 1 : 0;
  });
}
// The protocol as it stands on day dk: base fields overlaid with the timeline entry in force.
function protoAt(p, dk) {
  if (!p || !Array.isArray(p.timeline) || !p.timeline.length) return p;
  var tl = timelineSorted(p.timeline), pick = null;
  for (var i = 0; i < tl.length; i++) { var e = tl[i]; if (e.from == null || e.from <= dk) pick = e; else break; }
  if (!pick) pick = tl[0];
  var out = Object.assign({}, p);
  TIMELINE_FIELDS.forEach(function(k) { if (pick[k] !== undefined) out[k] = pick[k]; });
  out._tlFrom = pick.from || null;
  return out;
}
// Next dated revision after dk (for "new plan from …" hints). null when none.
function nextRevision(p, dk) {
  if (!p || !Array.isArray(p.timeline)) return null;
  var tl = timelineSorted(p.timeline);
  for (var i = 0; i < tl.length; i++) if (tl[i].from != null && tl[i].from > dk) return tl[i];
  return null;
}
// Is the (resolved) protocol due on dk? PRN never is. Interval schedules count from anchor.
function dueOn(p, dk) {
  var s = (p && p.schedule) || {};
  if (+s.every > 1) {
    var a = dkOf(s.anchor) || dkOf(p.startDate); if (!dkValid(a)) return true;
    var n = +s.every, diff = dkDiff(dk, a); return ((diff % n) + n) % n === 0;
  }
  var days = s.days || ALL_DAYS; if (days.length === 0) return false;
  return days.indexOf(dkDow(dk)) >= 0;
}
function inRange(p, dk) {
  var s = dkOf(p && p.startDate), e = dkOf(p && p.endDate);
  if (dkValid(s) && dk < s) return false;
  if (dkValid(e) && dk > e) return false;
  return true;
}
// Does the plan put this protocol on the calendar for dk (ignoring logs)? Archived protocols
// (active:false with no endDate) are hidden everywhere; finished ones stay visible inside their range.
function activeOn(p, dk) {
  if (!p) return false;
  if (p.active === false && !dkValid(dkOf(p.endDate))) return false;
  return inRange(p, dk);
}
// Mirror the entry effective today into the base fields; mirror interval schedules into legacy
// `days` (the weekdays due over today..today+6); flip finished protocols inactive for legacy readers.
// Returns the SAME object when nothing changes, so callers can skip a state write.
function materializeProto(p, todayDk) {
  if (!p) return p;
  todayDk = todayDk || dkToday();
  var out = p, changed = false;
  var touch = function() { if (!changed) { out = Object.assign({}, p); changed = true; } };
  if (Array.isArray(p.timeline) && p.timeline.length) {
    var cur = protoAt(p, todayDk);
    if (!schedEq(p.schedule, cur.schedule)) { touch(); out.schedule = Object.assign({}, cur.schedule); }
    ['doseMcg','doseUnit','doseValue'].forEach(function(k) {
      var a = p[k] == null ? null : p[k], b = cur[k] == null ? null : cur[k];
      if (a !== b) { touch(); out[k] = cur[k] == null ? null : cur[k]; }
    });
  }
  var s = out.schedule;
  if (s && +s.every > 1) {
    var days = [];
    for (var i = 0; i < 7; i++) { var dk = dkAdd(todayDk, i); if (dueOn(out, dk)) days.push(dkDow(dk)); }
    days.sort();
    if (!arrEq(s.days, days)) { touch(); out.schedule = Object.assign({}, s, { days: days }); }
  }
  var e = dkOf(out.endDate);
  if (dkValid(e) && e < todayDk && out.active !== false) { touch(); out.active = false; }
  return changed ? out : p;
}
function materializeAll(list, todayDk) {
  if (!Array.isArray(list)) return list;
  var changed = false;
  var next = list.map(function(p) { var m = materializeProto(p, todayDk); if (m !== p) changed = true; return m; });
  return changed ? next : list;
}
// Apply a schedule/dose revision effective `from` (dk) — or rewrite the original plan when from is
// null. Guarantees an original-plan snapshot exists before the first dated entry is added.
function applyRevision(p, from, fields, todayDk) {
  var entryFields = {};
  TIMELINE_FIELDS.forEach(function(k) { if (fields[k] !== undefined) entryFields[k] = fields[k]; });
  var tl = Array.isArray(p.timeline) ? p.timeline.slice() : [];
  if (from == null) {
    if (!tl.length) return materializeProto(Object.assign({}, p, entryFields), todayDk);
    tl = tl.map(function(e) { return e.from == null ? Object.assign({}, e, entryFields) : e; });
    if (!tl.some(function(e) { return e.from == null; })) tl.unshift(Object.assign({ id: 'tl_' + Date.now().toString(36), from: null }, entryFields));
    return materializeProto(Object.assign({}, p, { timeline: tl }), todayDk);
  }
  if (!tl.length) {
    var base = { id: 'tl_base_' + Date.now().toString(36), from: null };
    TIMELINE_FIELDS.forEach(function(k) { base[k] = p[k] == null ? null : p[k]; });
    tl.push(base);
  }
  tl = tl.filter(function(e) { return e.from !== from; });
  tl.push(Object.assign({ id: 'tl_' + Date.now().toString(36) + Math.floor(Math.random() * 999).toString(36), from: from }, entryFields));
  return materializeProto(Object.assign({}, p, { timeline: timelineSorted(tl) }), todayDk);
}
// Drop a dated revision. Dropping the last dated entry removes the timeline entirely.
function removeRevision(p, entryId, todayDk) {
  var tl = (p.timeline || []).filter(function(e) { return e.id !== entryId; });
  var dated = tl.filter(function(e) { return e.from != null; });
  var out = Object.assign({}, p);
  if (!dated.length) {
    var base = tl.find(function(e) { return e.from == null; });
    if (base) TIMELINE_FIELDS.forEach(function(k) { if (base[k] !== undefined) out[k] = base[k]; });
    delete out.timeline;
  } else out.timeline = tl;
  return materializeProto(out, todayDk);
}
// Finish a cycle on dk: no appearances after dk, later revisions discarded, history untouched.
function finishProto(p, dk, todayDk) {
  var tl = Array.isArray(p.timeline) ? p.timeline.filter(function(e) { return e.from == null || e.from <= dk; }) : null;
  var out = Object.assign({}, p, { endDate: dk, finishedAt: new Date().toISOString() });
  if (tl) { if (tl.filter(function(e) { return e.from != null; }).length) out.timeline = tl; else { var b = tl.find(function(e) { return e.from == null; }); if (b) TIMELINE_FIELDS.forEach(function(k) { if (b[k] !== undefined) out[k] = b[k]; }); delete out.timeline; } }
  return materializeProto(out, todayDk);
}
function resumeProto(p, todayDk) {
  var out = Object.assign({}, p, { active: true }); delete out.endDate; delete out.finishedAt;
  return materializeProto(out, todayDk);
}
// Back-dated entries over [fromDk, toDk]: one log per day the protocol was due (or every day when
// onlyScheduled is false), skipping days that already carry ANY log for that protocol (a skip is a
// decision too). Pure: returns the new logs only.
function buildBackfillLogs(p, fromDk, toDk, opts, existingLogs) {
  opts = opts || {};
  var out = [], have = {};
  (existingLogs || []).forEach(function(l) { if (l.protocolId === p.id) have[dkOf(l.datetime)] = true; });
  if (!dkValid(fromDk) || !dkValid(toDk) || fromDk > toDk) return out;
  var time = /^\d{2}:\d{2}$/.test(opts.time || '') ? opts.time : '08:00';
  for (var dk = fromDk, n = 0; dk <= toDk && n < 400; dk = dkAdd(dk, 1), n++) {
    if (have[dk]) continue;
    var pr = protoAt(p, dk);
    if (opts.onlyScheduled !== false && !dueOn(pr, dk)) continue;
    var doseMcg = opts.doseMcg != null ? opts.doseMcg : pr.doseMcg;
    var doseMl = opts.doseMl != null ? opts.doseMl : (opts.mcgPerMl > 0 && doseMcg > 0 ? Math.round(doseMcg / opts.mcgPerMl * 1000) / 1000 : null);
    var log = { id: (opts.idPrefix || 'bd_') + dk + (opts.idPrefix ? '' : '_' + Math.floor(Math.random() * 1e6).toString(36)),
      peptide: p.peptideName, peptideId: p.peptideId, vialId: opts.vialId || null, protocolId: p.id, profile: p.profile,
      datetime: dk + 'T' + time, doseMcg: doseMcg, doseMl: doseMl,
      notes: opts.notes || 'Back-dated entry', backfilled: true };
    var unit = opts.doseUnit !== undefined ? opts.doseUnit : (pr.doseUnit || null);
    if (unit && unit !== 'mcg') { log.doseUnit = unit; log.doseValue = unit === 'mg' ? doseMcg / 1000 : unit === 'g' ? doseMcg / 1e6 : doseMcg; }
    out.push(log);
  }
  return out;
}
// ===== SCHEDULE-ENGINE-END =====

// ===== MIGRATIONS-BEGIN (tests slice this block together with the engine) =====
// ── One-time data migrations ──────────────────────────────────────────────────────────────────
// Each runs once per cloud blob (marker in meta.migrations, which travels in the sync payload)
// and is ALSO idempotent on its own: deterministic ids mean a re-run can never duplicate anything.
const MIGRATIONS = [
  {
    // 2026-10-02 (Roman):
    //  (1) Testosterone Cypionate is taken DAILY, 20 mg (0.1 mL) — not Tue/Thu/Sat. Recorded as a
    //      dated plan revision from 2026-08-22 (assumed: the Anavar cycle start; adjust the date in
    //      the tile → Plan → Change from…, or remove the entry in Plan history) and back-filled on
    //      every day since that carries no testosterone entry. Today is left for the user to log.
    //  (2) Anavar 50 mg/day, 2026-08-22 → 2026-09-28, cycle finished — logged for every day.
    id: 'm1_roman_test_daily_anavar_2026-10', profile: 'Roman',
    run({ protocols, logs, vials }, todayDk) {
      const FROM = '2026-08-22';
      let ps = protocols.slice(), ls = logs.slice();
      const tIdx = ps.findIndex(p => p.profile === 'Roman' && p.active !== false && p.route !== 'pen' &&
        (p.peptideId === 'testosterone' || p.peptideId === 'testosterone-cypionate' || /testosterone\s*cyp/i.test(p.peptideName || '')));
      if (tIdx >= 0) {
        const tp = ps[tIdx];
        if (!(tp.timeline || []).some(e => e.id === 'tl_m1_test_daily')) {
          const daily = { id: 'tl_m1_test_daily', from: FROM, schedule: { days: ALL_DAYS.slice(), timeOfDay: (tp.schedule && tp.schedule.timeOfDay) || 'morning' }, doseMcg: 20000, doseUnit: 'mg', doseValue: 20 };
          const tl = (tp.timeline && tp.timeline.length) ? tp.timeline.concat([daily])
            : [{ id: 'tl_m1_test_base', from: null, schedule: tp.schedule || { days: ALL_DAYS.slice(), timeOfDay: 'morning' }, doseMcg: tp.doseMcg, doseUnit: tp.doseUnit || null, doseValue: tp.doseValue || null }, daily];
          ps[tIdx] = { ...tp, timeline: timelineSorted(tl) };
        }
        const vial = (vials || []).find(v => v.peptideId === tp.peptideId && v.active !== false && (v.mcgPerMl || 0) > 0) || null;
        const add = buildBackfillLogs(ps[tIdx], FROM, dkAdd(todayDk, -1), { idPrefix: 'bf_m1_test_', doseMcg: 20000, doseUnit: 'mg', doseMl: 0.1, time: '07:00', vialId: vial ? vial.id : null, notes: 'Back-dated · daily 20 mg (0.1 mL)' }, ls);
        const tDays = new Set(ls.filter(l => /testosterone/i.test(l.peptideId || '') || /testosterone/i.test(l.peptide || '')).map(l => dkOf(l.datetime)));
        ls = ls.concat(add.filter(l => !tDays.has(dkOf(l.datetime))));   // a shot logged under ANY testosterone protocol that day counts
      }
      if (!ps.some(p => p.id === 'p_m1_anavar')) {
        const ap = { id: 'p_m1_anavar', profile: 'Roman', peptideId: 'anavar', peptideName: 'Anavar (Oxandrolone)', doseMcg: 50000, doseUnit: 'mg', doseValue: 50, route: 'oral', oralPerUnitMcg: null, oralUnitLabel: 'mg',
          schedule: { days: ALL_DAYS.slice(), timeOfDay: 'morning' }, cycleDays: 38, startDate: FROM, endDate: '2026-09-28', finishedAt: '2026-09-28T23:59:00.000Z', active: false, createdAt: new Date().toISOString(), backfilled: true };
        ps.unshift(ap);
        ls = ls.concat(buildBackfillLogs(ap, FROM, '2026-09-28', { idPrefix: 'bf_m1_anavar_', doseMcg: 50000, doseUnit: 'mg', time: '08:00', notes: 'Back-dated · Anavar 50 mg/day, Aug 22 – Sep 28' }, ls));
      }
      return { protocols: ps, logs: ls };
    }
  }
];
function runMigrations(state, profile, todayDk) {
  const done = new Set((state.meta && Array.isArray(state.meta.migrations)) ? state.meta.migrations : []);
  let protocols = state.protocols || [], logs = state.logs || [], meta = state.meta || {}, changed = false;
  for (const m of MIGRATIONS) {
    if (done.has(m.id) || (m.profile && m.profile !== profile)) continue;
    try {
      const r = m.run({ protocols, logs, vials: state.vials || [] }, todayDk) || {};
      protocols = r.protocols || protocols; logs = r.logs || logs;
      meta = { ...meta, migrations: [...(meta.migrations || []), m.id] }; changed = true;
      console.log('[migration] applied ' + m.id);
    } catch (e) { console.error('[migration] ' + m.id + ' failed', e); }
  }
  return { protocols, logs, meta, changed };
}

// ===== MIGRATIONS-END =====
// ── 2026-09-03 (Roman): the gate ADVISES, it does not veto. ─────────────────
// Every safety BLOCK (≥5× prior dose, ≥5× weekly exposure, ceiling breach,
// unit change, unknown/first-time compound, volume-as-mass) is downgraded to a
// CONFIRM the user can override with "Log anyway". The entry is still tagged
// needsReview so peptide-tracker/Claude sees it on the next sync. The ONLY
// remaining hard stop is a missing/invalid dose — there is no number to write.
// The gate function above is untouched: it stays the shared, tested analyzer;
// this wrapper decides what the APP does with its verdict.
function softenVerdict(v) {
  if (!v || v.decision !== 'BLOCK') return v;
  const unwritable = (v.reasons || []).some(r => /missing\/invalid dose/.test(r));
  if (unwritable) return v;                       // no number to log — still hard
  const msg = String(v.message || '')
    .replace(/^BLOCKED — /, 'WARNING — ')
    .replace(/ Re-enter the intended dose or finish in Claude\.$/,
             ' Log it anyway if this is what you intended — it gets flagged for review.');
  return { ...v, decision: 'CONFIRM', severity: 'warn', wasBlocked: true, needsReview: true, message: msg };
}

// ── Gate wiring (policy: D60 tiers, softened 2026-09-01 per Roman: warnings inform, never wall) ──
// knownCompound: the compound has a settled protocol dose OR prior non-skipped logs.
// priorDoseMcg: the PROTOCOL's settled dose is the baseline (it already passed the protocol-save
// gate); logs are only the fallback. Comparing against the last log instead let a stale titration
// log from months ago flag today's normal protocol dose as "≥5× prior" (the Cagrilintide 0→1 mg
// false block) — the settled dose is what "prior" means once a protocol exists.
function gateContextFor(proto, logs) {
  const ids = new Set(getEquivalentIds(proto.peptideId));
  const prior = (logs || []).filter(l => ids.has(l.peptideId) && !l.skipped && l.doseMcg > 0)
    .sort((x, y) => new Date(y.datetime) - new Date(x.datetime))[0] || null;
  const protoDose = (proto.doseMcg != null && proto.doseMcg > 0) ? proto.doseMcg : null;
  const freq = freqPerWeek(proto.schedule || { days: [0,1,2,3,4,5,6] });
  return {
    knownCompound: !!(protoDose || prior),
    priorDoseMcg: protoDose || (prior ? prior.doseMcg : null),
    priorUnit: proto.doseUnit || (prior && prior.doseUnit) || null,
    priorFrequencyPerWeek: freq,
    priorRoute: proto.route || null,
    scheduledDoseMcg: protoDose,
  };
}
// Runs the gate for a dose about to be written. Returns the verdict object.
function runDoseGate(proto, doseMcg, opts, logs) {
  opts = opts || {};
  const ctx = gateContextFor(proto, logs);
  return softenVerdict(evaluateDose({
    peptideId: proto.peptideId,
    peptideName: proto.peptideName,
    doseMcg: doseMcg,
    doseUnit: opts.doseUnit || proto.doseUnit || null,
    route: proto.route || null,
    frequencyPerWeek: ctx.priorFrequencyPerWeek,
    isScheduledCheckoff: opts.isScheduledCheckoff === true,
  }, ctx));
}
// Boot self-check (console only; mirrors dose_gate.test.js core cases).
(function gateSelfTest(){
  try {
    const t1 = evaluateDose({ peptideId:'tadalafil', doseMcg:60000, doseUnit:'mg' }, { knownCompound:true, priorDoseMcg:2500 });
    const t2 = evaluateDose({ peptideId:'ipamorelin', doseMcg:200, isScheduledCheckoff:true }, { knownCompound:true, priorDoseMcg:200, scheduledDoseMcg:200 });
    const t3 = evaluateDose({ peptideId:'bpc157', doseMcg:1200 }, { knownCompound:true, priorDoseMcg:500 });
    const t4 = evaluateDose({ peptideId:'hcg', doseMcg:250, doseUnit:'mg' }, { knownCompound:true, priorDoseMcg:250, priorUnit:'IU' });
    const ok = t1.decision==='BLOCK' && t2.decision==='PASS' && t3.decision==='CONFIRM' && t4.decision==='BLOCK';
    console[ok?'log':'error']('[dose-gate self-test] ' + (ok?'PASS':'FAIL'), {t1:t1.decision,t2:t2.decision,t3:t3.decision,t4:t4.decision});
  } catch(e){ console.error('[dose-gate self-test] threw', e); }
})();

/* ══════════ Liquid Glass kit — route/block mapping, syringe, icons ══════════ */
const LG = { accent:'#e3c886', green:'#5fdc97', amber:'#f78c3a', red:'#ff6b6b',
  text:'#f3f6f8', dim:'rgba(255,255,255,0.60)', dim2:'rgba(255,255,255,0.38)', hair:'rgba(255,255,255,0.12)',
  mono:"'JetBrains Mono', ui-monospace, monospace" };
const ROUTE_META = {
  inj:   { label:'Inject', color:'#e3c886', verb:'Draw'  },
  oral:  { label:'Oral',   color:'#f78c3a', verb:'Take'  },
  nasal: { label:'Nasal',  color:'#c78bf0', verb:'Spray' },
};
// Derive route. Explicit protocol route wins; else vial formType; else compound route string.
function routeOf(proto, vial) {
  const pr = proto && proto.route;
  if (pr === 'inj' || pr === 'oral' || pr === 'nasal' || pr === 'spray' || pr === 'pen') return pr === 'spray' ? 'nasal' : pr;
  const ft = vial && vial.formType;
  if (ft === 'oral') return 'oral';
  if (ft === 'spray' || ft === 'nasal') return 'nasal';
  // A reconstituted liquid vial means injectable — checked BEFORE the compound-DB string so a
  // dual-route compound (Cartalax "Oral or SubQ") with a real vial administers as an injection.
  // The mcgPerMl fallback covers synced/legacy vials that carry no formType field.
  if (vial && (ft === 'liquid' || (vial.mcgPerMl || 0) > 0)) return 'inj';
  const pep = findPep(proto && proto.peptideId);
  const r = ((pep && pep.protocol && pep.protocol.route) || '').toLowerCase();
  if (/oral|capsule|sublingual|tablet/.test(r)) return 'oral';
  if (/nasal|intranasal|spray/.test(r)) return 'nasal';
  return 'inj';
}
// Route-appropriate delivery: syringe units (inj) / # pills (oral) / # sprays (nasal).
function deliveryFor(proto, vial) {
  const route = routeOf(proto, vial);
  const dMcg = proto.doseMcg || 0;
  if (route === 'oral') {
    const per = proto.oralPerUnitMcg || 0;
    if (per > 0) { const n = Math.max(0.5, Math.round((dMcg/per)*2)/2); return { route, chip: n+(n===1?' cap':' caps'), n, kind:'caps' }; }
    return { route, chip:'oral', kind:'caps' };
  }
  if (route === 'nasal') {
    const perSpray = (proto.sprayMcgPerMl || 0) * (proto.sprayMlPerSpray || 0);
    if (perSpray > 0) { const n = Math.max(1, Math.round(dMcg/perSpray)); return { route, chip: n+(n===1?' spray':' sprays'), n, kind:'sprays', perSpray }; }
    return { route, chip:'spray', kind:'sprays' };
  }
  // injection
  if (vial && vial.mcgPerMl) { const u = dMcg/(vial.mcgPerMl/100); return { route, chip:(Math.round(u*10)/10)+'u', n:u, kind:'units' }; }
  return { route, chip:'—', kind:'units' };
}
// Map schedule timing → time block (am / pre / pm / prn).
function blockOf(proto) {
  const sched = proto.schedule || {};
  const tod = (sched.timeOfDay || '').toLowerCase();
  const days = sched.days;
  if (Array.isArray(days) && days.length === 0) return 'prn';
  if (/pre|work/.test(tod)) return 'pre';
  if (/eve|night|bed|pm/.test(tod)) return 'pm';
  return 'am';
}
const LG_BLOCKS = [
  { id:'am',  label:'AM Block',    hint:'Morning' },
  { id:'pre', label:'Pre-Workout', hint:'Before training' },
  { id:'pm',  label:'PM Block',    hint:'Evening' },
  { id:'prn', label:'As Needed',   hint:'No fixed schedule' },
];
// Named refillable pens (3 mL each, dosed in U-100 syringe units → 300 units full).
const PEN_META = {
  golden: { label:'Golden Pen', color:'#E8C39E', emoji:'🟡' },
  purple: { label:'Purple Pen', color:'#C084FC', emoji:'🟣' },
  black:  { label:'Black Pen',  color:'#9aa0a6', emoji:'⚫' },
  blue:   { label:'Blue Pen',   color:'#4fd6e6', emoji:'🔵' },
  green:  { label:'Green Pen',  color:'#5fdc97', emoji:'🟢' },
  pink:   { label:'Pink Pen',   color:'#f0399c', emoji:'🩷' },
  red:    { label:'Red Pen',    color:'#ff6b6b', emoji:'🔴' },
  white:  { label:'White Pen',  color:'#e8e8ee', emoji:'⚪' },
};
const PEN_ORDER = ['blue','purple','black','golden','green','pink','red','white'];
const PEN_VOL_ML = 3;
// Label/color for a pen protocol or vial, honoring an optional custom name.
function penLabelOf(o) { const m = PEN_META[o && o.penColor] || PEN_META.blue; return (o && o.penName) ? o.penName : m.label; }
function penColorOf(o) { return (PEN_META[o && o.penColor] || PEN_META.blue).color; }
// Expand pen components, splitting any known blend (KLOW/GLOW/etc) into its individual peptides; merges duplicates.
function expandPenComponents(comps) {
  const out = {};
  (comps || []).forEach(c => {
    const pep = findPep(c.peptideId);
    const add = (pid, mcg) => { const sp = findPep(pid); const key = pid || (c.name||''); if (out[key]) out[key].mcg += mcg; else out[key] = { peptideId: pid, name: sp ? sp.name : (c.name || pid), icon: sp ? sp.icon : (c.icon || '💊'), mcg }; };
    if (pep && pep.ingredients && Object.keys(pep.ingredients).length) Object.entries(pep.ingredients).forEach(([sid, frac]) => add(sid, (c.mcg||0) * frac));
    else add(c.peptideId, c.mcg || 0);
  });
  return Object.values(out);
}
// Preferred reconstitution solvent per compound (default: bacteriostatic water).
const SOLVENT_OVERRIDE = { 'ara-290':'PBS (phosphate-buffered saline)', 'igf1-lr3':'acetic acid', 'aod9604':'acetic acid' };
function solventFor(peptideId, components) {
  // For a blend/pen, surface any special-solvent component.
  if (components && components.length) {
    const special = components.map(c => c.peptideId || c.id).find(id => SOLVENT_OVERRIDE[id]);
    if (special) return SOLVENT_OVERRIDE[special] + ' (for ' + (findPep(special) ? findPep(special).name : special) + ')';
  }
  return SOLVENT_OVERRIDE[peptideId] || 'bacteriostatic water (BAC)';
}
// Route icon (line-art): syringe / pill / spray
function RouteIcon({ route, color, s=16 }) {
  const p = { width:s, height:s, viewBox:'0 0 24 24', fill:'none', stroke:color, strokeWidth:1.7, strokeLinecap:'round', strokeLinejoin:'round' };
  if (route === 'oral') return <svg {...p}><rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-45 12 12)"/><path d="M9 9l6 6"/></svg>;
  if (route === 'nasal') return <svg {...p}><path d="M9.4 9.5V6.6h3.4v2.9"/><rect x="10.4" y="3.4" width="2.6" height="3.2" rx="0.7"/><rect x="7" y="9.2" width="8.4" height="11.4" rx="2.4"/><path d="M15.2 4.3h2.4M15.4 6.2l2.3 .3M15.5 2.5l2-1"/></svg>;
  return <svg {...p}><path d="M18 3l3 3M16 5l3 3"/><path d="M17.5 6.5L9 15l-1.5 4.5L3 21l1.5-4.5L13 8"/><path d="M11 10l3 3"/></svg>;
}
// Tab-bar line-art icons
function NavIcon({ id, color }) {
  const p = { width:22, height:22, viewBox:'0 0 24 24', fill:'none', stroke:color, strokeWidth:1.8, strokeLinecap:'round', strokeLinejoin:'round' };
  if (id==='protocol') return <svg {...p}><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M8 14.5l2 2 4-4"/></svg>;
  if (id==='plan') return <svg {...p}><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>;
  if (id==='lab') return <svg {...p}><path d="M9 3h6M10 3v6l-5 8a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-8V3"/></svg>;
  if (id==='history') return <svg {...p}><path d="M4 6h16M4 12h9M4 18h6"/><circle cx="17.5" cy="16.5" r="3.6"/><path d="M17.5 14.6v1.9l1.3.9"/></svg>;
  return <svg {...p}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h3M14 9h2M14 14.5h2M9 13v3M7.9 17.1l2.2-2.2M10.1 17.1l-2.2-2.2"/></svg>;
}
// Procedural U-100 insulin syringe filled to `units`.
function Syringe({ units, max, color }) {
  color = color || LG.accent;
  const u = Math.max(0, +units || 0);
  const M = max || (u<=10?10 : u<=30?30 : u<=50?50 : 100);
  const X0=30, X1=202, W=X1-X0, Y=10, H=20;
  const fillW = Math.min(1, u/M) * W;
  const px = X0 + fillW;
  const ticks = [];
  for (let i=0;i<=10;i++){
    const x = X0 + W*i/10, major = i%2===0;
    ticks.push(<line key={'t'+i} x1={x} y1={Y+H} x2={x} y2={Y+H+(major?8:4)} stroke="rgba(255,255,255,.40)" strokeWidth="1"/>);
    if (major) ticks.push(<text key={'l'+i} x={x} y={Y+H+19} fill="rgba(255,255,255,.5)" fontSize="8" fontFamily={LG.mono} textAnchor="middle">{Math.round(M/10*i)}</text>);
  }
  return (
    <svg viewBox="0 0 246 50" width="100%" style={{display:'block'}}>
      <rect x="2" y="7" width="7" height={H+6} rx="2" fill={color}/>
      <line x1="9" y1={Y+H/2} x2={px} y2={Y+H/2} stroke={color} strokeWidth="3"/>
      <rect x={X0} y={Y} width={W} height={H} rx="3" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.35)" strokeWidth="1.3"/>
      <rect x={X0} y={Y} width={fillW} height={H} fill={color} opacity="0.34"/>
      <rect x={Math.max(X0,px-1.6)} y={Y} width="1.6" height={H} fill={color}/>
      <rect x={px-1.5} y={Y-3} width="3" height={H+6} rx="1" fill={color}/>
      <rect x={X1} y={Y+H/2-5} width="7" height="10" rx="1" fill="rgba(255,255,255,.28)"/>
      <line x1={X1+7} y1={Y+H/2} x2="242" y2={Y+H/2} stroke="rgba(255,255,255,.45)" strokeWidth="1.3"/>
      {ticks}
    </svg>
  );
}

// Type selector + route-specific dosing fields for the protocol new/edit forms.
function RouteFields({ f, setF }) {
  const route = f.route || 'inj';
  const oralUnit = f.oralUnitLabel || 'mcg';
  // Main dose unit (display + entry only). Canonical store is always f.doseMcg in mcg.
  // mcg & IU use factor 1 (IU = the mcg-number-IS-the-IU-value proxy); mg ×1000; g ×1e6.
  const doseUnit = f.doseUnit || 'mcg';
  const duFactor = doseUnit === 'g' ? 1e6 : doseUnit === 'mg' ? 1000 : 1;
  const doseDisp = (f.doseMcg === '' || f.doseMcg == null || isNaN(parseFloat(f.doseMcg))) ? '' : (duFactor === 1 ? f.doseMcg : (parseFloat(f.doseMcg) / duFactor));
  const lbl = { fontSize:12, color:'var(--text-dim)', fontWeight:600, display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' };
  const preview = deliveryFor({ ...f, doseMcg: parseFloat(f.doseMcg)||0, route, oralPerUnitMcg: parseFloat(f.oralPerUnitMcg)||0, sprayMcgPerMl: parseFloat(f.sprayMcgPerMl)||0, sprayMlPerSpray: parseFloat(f.sprayMlPerSpray)||0 }, null);
  return (
    <>
      <Field label="Type">
        <div style={{display:'flex',gap:7}}>
          {[['inj','💉 Injection','#e3c886'],['oral','💊 Oral','#f78c3a'],['nasal','👃 Nasal spray','#c78bf0']].map(([k,l,col]) => { const on=route===k; return <button key={k} onClick={()=>setF({...f,route:k})} style={{flex:1,padding:'10px 4px',borderRadius:12,fontSize:12,fontWeight:600,border:'1px solid '+(on?col+'66':'var(--border)'),background:on?col+'1f':'rgba(255,255,255,.04)',color:on?col:'var(--text-dim)',cursor:'pointer'}}>{l}</button>; })}
        </div>
      </Field>
      {route === 'oral' ? (
        <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,alignItems:'flex-end',marginBottom:10}}>
          <div><label style={lbl}>Dose per cap ({oralUnit})</label><input type="number" value={(f.oralPerUnitMcg!=null && f.oralPerUnitMcg!=='') ? (oralUnit==='mg'?(f.oralPerUnitMcg/1000):f.oralPerUnitMcg) : ''} onChange={e=>{const v=parseFloat(e.target.value)||0; setF({...f, oralPerUnitMcg: oralUnit==='mg'? v*1000 : v});}} className="input"/></div>
          <div style={{display:'flex',gap:4}}>{['mcg','mg'].map(u=><button key={u} onClick={()=>setF({...f,oralUnitLabel:u})} style={{padding:'0 12px',height:48,borderRadius:12,fontSize:13,fontWeight:600,fontFamily:'var(--mono)',border:'1px solid '+(oralUnit===u?'rgba(227,200,134,.5)':'var(--border)'),background:oralUnit===u?'rgba(227,200,134,.16)':'rgba(255,255,255,.04)',color:oralUnit===u?'var(--accent)':'var(--text-dim)',cursor:'pointer'}}>{u}</button>)}</div>
        </div>
      ) : route === 'nasal' ? (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
          <Field label="Conc (mcg/mL)"><input type="number" value={f.sprayMcgPerMl||''} onChange={e=>setF({...f,sprayMcgPerMl:e.target.value})} className="input"/></Field>
          <Field label="mL per spray"><input type="number" step="0.01" value={f.sprayMlPerSpray||''} onChange={e=>setF({...f,sprayMlPerSpray:e.target.value})} className="input"/></Field>
        </div>
      ) : null}
      <Field label={`Standard dose (${doseUnit})`}>
        <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,alignItems:'center'}}>
          <input type="number" value={doseDisp} onChange={e=>setF({...f, doseMcg: duFactor===1 ? e.target.value : Math.round((parseFloat(e.target.value)||0)*duFactor)})} className="input"/>
          <div style={{display:'flex',gap:4}}>{['mcg','mg','g','IU'].map(u=><button key={u} type="button" onClick={()=>setF({...f,doseUnit:u})} style={{padding:'0 9px',height:48,borderRadius:12,fontSize:12,fontWeight:600,fontFamily:'var(--mono)',border:'1px solid '+(doseUnit===u?'rgba(227,200,134,.5)':'var(--border)'),background:doseUnit===u?'rgba(227,200,134,.16)':'rgba(255,255,255,.04)',color:doseUnit===u?'var(--accent)':'var(--text-dim)',cursor:'pointer'}}>{u}</button>)}</div>
        </div>
      </Field>
      {(route==='oral'||route==='nasal') && (parseFloat(f.doseMcg)||0)>0 && preview.n!=null && (
        <div style={{fontSize:12.5,color:'var(--text-dim)',margin:'-2px 2px 12px'}}>→ {route==='oral'?'Take':'Use'} <b style={{color: route==='oral'?'var(--rt-oral)':'#c78bf0'}}>{preview.chip}</b> per dose {route==='inj'?'':''}</div>
      )}
    </>
  );
}

// Reconstitution block for injectable protocols in the Add/Edit forms: vial size + BAC water with a
// live "draw N units" preview for the standard dose. f.reconMg is CANONICAL MG (IU compounds display
// ×1000 and store /1000, the same proxy the administer sheet and HCG vials use), so toggling the
// dose unit can never silently reinterpret the number. IU-ness is vial-aware (f.reconIsIU from
// prefill) OR protocol-unit-driven, mirroring the administer sheet's reconIsIU. Edits set
// f.reconDirty so untouched DB-guessed prefills are never persisted from the Edit form.
// Both fields blank = settle at first log (and, when a vial was already set, clears its draw).
function ReconFields({ f, setF }) {
  if ((f.route || 'inj') !== 'inj') return null;
  const isIU = f.doseUnit === 'IU' || !!f.reconIsIU;
  const oil = isOilPep(f.peptideId);   // pre-mixed oil: the vial IS the concentration, nothing to reconstitute
  const mg = parseFloat(f.reconMg) || 0;
  const ml = parseFloat(f.reconMl) || 0;
  const dose = parseFloat(f.doseMcg) || 0;
  const m = (mg > 0 && ml > 0) ? vialMath(mg, ml, dose) : null;
  const partial = (mg > 0) !== (ml > 0);
  const overVial = m && dose > 0 && m.totalDoses < 1;      // dose exceeds the whole vial
  const overBarrel = m && dose > 0 && m.unitsPerDose > 100; // draw beyond a full U-100 syringe
  const suspect = overVial || overBarrel;
  const lbl = { fontSize:11, color:'var(--text-faint)', textTransform:'uppercase', fontWeight:700, letterSpacing:'0.04em' };
  return (
    <div style={{background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', padding:12, borderRadius:14, marginBottom:10}}>
      <div style={{fontSize:11, fontWeight:700, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8}}>{oil ? '🧴 Vial concentration (pre-mixed oil)' : '🧪 Reconstitution'}</div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
        <div>
          <label style={lbl}>{isIU ? 'Vial (IU)' : oil ? 'Total in vial (mg)' : 'Vial size (mg)'}</label>
          <input type="number" step={isIU ? '1' : '0.1'}
            value={isIU ? (f.reconMg !== '' && !isNaN(parseFloat(f.reconMg)) ? Math.round(parseFloat(f.reconMg) * 1000) : '') : f.reconMg}
            onChange={e => { const v = e.target.value; setF(p => ({ ...p, reconDirty: true, reconMg: isIU ? (v === '' ? '' : String((parseFloat(v) || 0) / 1000)) : v })); }}
            className="input" style={{textAlign:'center', fontFamily:'var(--mono)', fontWeight:700}}/>
        </div>
        <div>
          <label style={lbl}>{oil ? 'Vial volume (mL)' : 'BAC water (mL)'}</label>
          <input type="number" step="0.1" value={f.reconMl} onChange={e => { const v = e.target.value; setF(p => ({ ...p, reconDirty: true, reconMl: v })); }}
            className="input" style={{textAlign:'center', fontFamily:'var(--mono)', fontWeight:700}}/>
        </div>
      </div>
      {m && dose > 0 ? (
        <>
          <div style={{display:'flex', alignItems:'baseline', gap:6, marginTop:10}}>
            <span style={{fontSize:12.5, color:'var(--text-dim)'}}>Draw</span>
            <span className="mono" style={{fontSize:20, fontWeight:700, color: suspect ? 'var(--amber)' : 'var(--accent)'}}>{m.unitsPerDose.toFixed(1)}</span>
            <span style={{fontSize:12.5, color:'var(--text-dim)'}}>units per dose</span>
            <span className="mono" style={{marginLeft:'auto', fontSize:11, color:'var(--text-faint)'}}>{isIU ? Math.round(m.mcgPerMl).toLocaleString() + ' IU/mL' : (m.mcgPerMl/1000).toFixed(2) + ' mg/mL'} · ~{m.totalDoses} doses</span>
          </div>
          {suspect && <div style={{fontSize:11.5, color:'var(--amber)', background:'rgba(247,140,58,0.10)', border:'1px solid rgba(247,140,58,0.25)', borderRadius:10, padding:'8px 10px', marginTop:8}}>{overVial ? '⚠ Dose exceeds this vial’s total content — check vial size or dose' : '⚠ Draw exceeds a U-100 syringe (100u = 1 mL) — check vial size or BAC volume'}</div>}
        </>
      ) : partial ? (
        <div style={{fontSize:11.5, color:'var(--amber)', marginTop:8}}>{oil ? 'Enter both the total mg and the vial volume to set the draw.' : 'Enter both vial size and BAC water to set the draw.'}</div>
      ) : (
        <div style={{fontSize:11.5, color:'var(--text-faint)', marginTop:8}}>{oil ? 'e.g. 2000 mg in 10 mL = 200 mg/mL (10 units = 20 mg). Optional — leave blank to settle it on your first log.' : 'Optional — leave blank to settle it on your first log.'}</div>
      )}
      {SOLVENT_OVERRIDE[f.peptideId] && <div style={{fontSize:11.5, color:'var(--amber)', background:'rgba(247,140,58,0.10)', border:'1px solid rgba(247,140,58,0.25)', borderRadius:10, padding:'8px 10px', marginTop:8}}>💡 Preferred solvent: <b>{SOLVENT_OVERRIDE[f.peptideId]}</b> (not plain BAC)</div>}
    </div>
  );
}

// ── Shared schedule controls (Add / Edit / Pen / Blend forms + the tile's Plan card) ──────────
const TOD_OPTIONS = [['morning','🌅 Morning'],['preworkout','💪 Pre-workout'],['noon','☀️ Mid-day'],['evening','🌆 Evening'],['bedtime','🌙 Before bed'],['anytime','⏱ Any time']];
const todLabel = (k) => ((TOD_OPTIONS.find(([x]) => x === (k || 'morning')) || ['', ''])[1]).replace(/^\S+\s/, '');
function TimeOfDaySelect({ value, onChange }) {
  return <select value={value || 'morning'} onChange={e => onChange(e.target.value)} className="input">{TOD_OPTIONS.map(([k,l]) => <option key={k} value={k}>{l}</option>)}</select>;
}
// Calendar-day label from a 'YYYY-MM-DD' key (year shown only when it isn't this year).
const fmtDk = (dk) => { const t = dkParse(dk); if (isNaN(t)) return '—'; const d = new Date(t); const thisYear = d.getUTCFullYear() === new Date().getFullYear(); return d.toLocaleDateString(undefined, { month:'short', day:'numeric', timeZone:'UTC', ...(thisYear ? {} : { year:'numeric' }) }); };
// Dose in its tagged unit (timeline entries, plan card, history rows).
const fmtDoseAny = (mcg, unit) => { if (mcg == null || isNaN(mcg)) return '—'; if (unit === 'IU') return fmtIU(mcg); if (unit === 'g') return (mcg/1e6).toFixed(2).replace(/\.?0+$/,'') + ' g'; if (unit === 'mg') return (mcg/1000).toFixed(2).replace(/\.?0+$/,'') + ' mg'; return fmtMcg(mcg); };
const DAY_PRESETS = { daily: ALL_DAYS, weekdays:[1,2,3,4,5], mwf:[1,3,5], tth:[2,4], wth:[3,4], weekly:[1], asneeded:[] };
const chipSt = (on, warn) => ({ background: on ? (warn ? 'rgba(247,140,58,0.16)' : 'rgba(227,200,134,0.16)') : 'rgba(255,255,255,0.06)', border: '1px solid ' + (on ? (warn ? 'rgba(247,140,58,0.4)' : 'rgba(227,200,134,0.45)') : 'var(--border)'), borderRadius: 100, padding: '7px 12px', minHeight: 34, fontSize: 11, color: on ? (warn ? 'var(--amber)' : 'var(--accent)') : 'var(--text-dim)', cursor: 'pointer', fontWeight: 600 });
// value = { days, every?, anchor?, timeOfDay } · onChange(next). Interval mode ("every other day")
// counts from `anchor` (first dose day) and shows a 14-day preview so the pattern is unambiguous.
function SchedulePicker({ value, onChange, anchorDefault, previewFrom }) {
  const v = value || {};
  const every = (+v.every > 1) ? Math.round(+v.every) : 1;
  const interval = every > 1;
  const days = v.days || ALL_DAYS;
  const anchor = dkValid(v.anchor) ? v.anchor : (dkValid(anchorDefault) ? anchorDefault : todayLocal());
  const chips = [['daily','Daily'],['eod','Every other day'],['weekdays','Weekdays'],['mwf','MWF'],['tth','TTh'],['weekly','Weekly'],['asneeded','As needed ⚡']];
  const isOn = (k) => k === 'eod' ? (interval && every === 2) : (!interval && arrEq(days, DAY_PRESETS[k]));
  const pick = (k) => k === 'eod' ? onChange({ ...v, every: 2, anchor, days: ALL_DAYS.slice() }) : onChange({ ...v, every: null, anchor: null, days: DAY_PRESETS[k].slice() });
  const toggleDay = (d) => onChange({ ...v, every: null, anchor: null, days: days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort() });
  const setEvery = (n) => onChange({ ...v, every: Math.max(2, Math.min(30, n)), anchor, days: ALL_DAYS.slice() });
  const previewStart = dkValid(previewFrom) ? previewFrom : todayLocal();
  const preview = interval ? Array.from({ length: 14 }, (_, i) => { const dk = dkAdd(previewStart, i); const d = new Date(dkParse(dk)); return { dk, due: dueOn({ schedule: { every, anchor } }, dk), wd: d.toLocaleDateString(undefined, { weekday:'narrow', timeZone:'UTC' }), n: d.getUTCDate() }; }) : null;
  const dl = ['S','M','T','W','T','F','S'];
  return (
    <>
      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
        {chips.map(([k,l]) => <button key={k} type="button" aria-pressed={isOn(k)} onClick={() => pick(k)} style={chipSt(isOn(k), k === 'asneeded')}>{l}</button>)}
      </div>
      {interval ? (
        <div className="lg" style={{borderRadius:14,padding:'10px 12px'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:12.5,color:'var(--text-dim)'}}>Every</span>
            <div style={{display:'inline-flex',alignItems:'center',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>
              <button type="button" aria-label="Fewer days between doses" onClick={() => setEvery(every - 1)} style={{width:38,height:36,border:'none',background:'rgba(255,255,255,.05)',color:'var(--text)',fontSize:18,cursor:'pointer'}}>−</button>
              <span className="mono" style={{minWidth:30,textAlign:'center',fontWeight:700,fontSize:15}}>{every}</span>
              <button type="button" aria-label="More days between doses" onClick={() => setEvery(every + 1)} style={{width:38,height:36,border:'none',background:'rgba(255,255,255,.05)',color:'var(--accent)',fontSize:18,cursor:'pointer'}}>＋</button>
            </div>
            <span style={{fontSize:12.5,color:'var(--text-dim)'}}>days{every === 2 ? ' · every other day' : ''}</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:8,alignItems:'center',marginTop:10}}>
            <label style={{fontSize:11,color:'var(--text-faint)',textTransform:'uppercase',fontWeight:700,letterSpacing:'0.04em'}}>First dose</label>
            <input type="date" value={anchor} onChange={e => { if (dkValid(e.target.value)) onChange({ ...v, every, anchor: e.target.value, days: ALL_DAYS.slice() }); }} className="input" style={{padding:'10px 12px'}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(14, 1fr)',gap:3,marginTop:10}} aria-label="Dose days over the next 14 days">
            {preview.map(p => <div key={p.dk} title={p.dk} style={{textAlign:'center'}}>
              <div style={{fontSize:8,color:'var(--text-ghost)',textTransform:'uppercase'}}>{p.wd}</div>
              <div className="mono" style={{fontSize:9.5,lineHeight:'18px',height:18,borderRadius:5,background:p.due?'rgba(227,200,134,.22)':'rgba(255,255,255,.04)',color:p.due?'var(--accent)':'var(--text-ghost)',fontWeight:p.due?700:500}}>{p.n}</div>
            </div>)}
          </div>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(7, 1fr)',gap:5}}>
          {dl.map((d,i) => <button key={i} type="button" aria-pressed={days.includes(i)} onClick={() => toggleDay(i)} style={{padding:'10px 0',borderRadius:10,border:'1px solid var(--border)',background:days.includes(i)?'rgba(227,200,134,0.18)':'rgba(255,255,255,0.04)',color:days.includes(i)?'var(--accent-2)':'var(--text-faint)',fontSize:11,fontWeight:700,cursor:'pointer'}}>{d}</button>)}
        </div>
      )}
    </>
  );
}
// "Apply changes from": today, a past day (back-dated correction) or a future day (switches by itself).
function ApplyFromPicker({ value, onChange, mode, setMode, hasTimeline }) {
  const today = todayLocal();
  const tomorrow = dkAdd(today, 1);
  const rel = value === today ? 'today' : value === tomorrow ? 'tomorrow' : value < today ? (-dkDiff(value, today)) + ' days ago' : 'in ' + dkDiff(value, today) + ' days';
  return (
    <Field label="Apply changes from">
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
        {[['Today', today], ['Tomorrow', tomorrow]].map(([l, dk]) => <button key={l} type="button" onClick={() => { setMode('date'); onChange(dk); }} style={chipSt(mode === 'date' && value === dk)}>{l}</button>)}
        <button type="button" onClick={() => setMode('date')} style={chipSt(mode === 'date' && value !== today && value !== tomorrow)}>Pick a date</button>
        <button type="button" onClick={() => setMode('start')} style={chipSt(mode === 'start', true)}>{hasTimeline ? 'Rewrite original plan' : 'Since the start'}</button>
      </div>
      {mode === 'date' ? (<>
        <input type="date" value={value} onChange={e => { if (dkValid(e.target.value)) onChange(e.target.value); }} className="input"/>
        <div style={{fontSize:11.5,color:'var(--text-faint)',marginTop:6}}>{rel.charAt(0).toUpperCase() + rel.slice(1)}. Days before keep the previous plan{value > today ? ' — the switch happens on its own.' : '.'}</div>
      </>) : (
        <div style={{fontSize:11.5,color:'var(--text-faint)'}}>Replaces the plan for every day{hasTimeline ? ' before the first dated change' : ''} — no history kept.</div>
      )}
    </Field>
  );
}
// A protocol's plan revisions, oldest first; dated entries can be removed.
function TimelineList({ timeline, onRemove }) {
  const tl = timelineSorted(timeline || []);
  if (!tl.length) return null;
  const today = todayLocal();
  let curIdx = -1; tl.forEach((e, i) => { if (e.from == null || e.from <= today) curIdx = i; });
  return (
    <Field label="Plan history">
      <div className="lg" style={{borderRadius:14,padding:'2px 12px'}}>
        {tl.map((e, i) => (
          <div key={e.id || i} style={{display:'flex',alignItems:'center',gap:8,minHeight:42,borderTop: i ? '1px solid var(--border-light)' : 'none'}}>
            <span className="mono" style={{fontSize:11,color: i === curIdx ? 'var(--accent)' : 'var(--text-faint)',minWidth:92,flexShrink:0}}>{e.from == null ? 'Original' : (e.from > today ? 'From ' : 'Since ') + fmtDk(e.from)}</span>
            <span style={{flex:1,minWidth:0,fontSize:12.5,color:'var(--text-2)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{schedLabel(e.schedule)} · {fmtDoseAny(e.doseMcg, e.doseUnit)}{i === curIdx && <span style={{color:'var(--accent)',fontSize:9.5,fontWeight:800,marginLeft:6,letterSpacing:'0.06em'}}>NOW</span>}</span>
            {e.from != null && onRemove && <button type="button" aria-label="Remove this change" onClick={() => onRemove(e.id)} style={{width:30,height:30,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-card-2)',color:'var(--danger)',cursor:'pointer',flexShrink:0}}>✕</button>}
          </div>
        ))}
      </div>
    </Field>
  );
}
// The tile sheet's Plan card: what's in force on the viewed day + change-from-date / finish / resume.
function PlanCard({ proto, dateKey, onChange, onFinish, onResume }) {
  const s = proto.schedule || {};
  const today = todayLocal();
  const isToday = dateKey === today;
  const endDk = dkOf(proto.endDate);
  const ended = dkValid(endDk);
  const next = nextRevision(proto, dateKey);
  const startDk = dkOf(proto.startDate);
  const dayN = (dkValid(startDk) && proto.cycleDays > 0 && !isPrnSched(s)) ? Math.max(1, dkDiff(dateKey, startDk) + 1) : null;
  const bits = [todLabel(s.timeOfDay)];
  if (dayN) bits.push('day ' + dayN + '/' + proto.cycleDays);
  if (proto._tlFrom) bits.push('since ' + fmtDk(proto._tlFrom));
  if (next) bits.push('changes ' + fmtDk(next.from) + ' → ' + schedLabel(next.schedule, true));
  if (ended) bits.push((endDk < today ? 'ended ' : 'ends ') + fmtDk(endDk));
  return (
    <div className="lg" style={{borderRadius:16, padding:'12px 14px', marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:800,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Plan · {isToday ? 'today' : fmtDk(dateKey)}</div>
      <div style={{fontSize:15,fontWeight:700,color:'var(--text)',marginTop:4}}>{schedLabel(s)} · <span className="mono" style={{color:'var(--accent)'}}>{fmtDoseAny(proto.doseMcg, proto.doseUnit)}</span></div>
      <div style={{fontSize:11.5,color:'var(--text-dim)',marginTop:3}}>{bits.join(' · ')}</div>
      <div style={{display:'flex',gap:8,marginTop:10}}>
        <button className="btn btn-ghost" style={{flex:1,minHeight:40,fontSize:12}} onClick={onChange}>Change from {isToday ? 'today' : fmtDk(dateKey)}</button>
        {ended
          ? <button className="btn btn-ghost" style={{flex:1,minHeight:40,fontSize:12,color:'var(--success)'}} onClick={onResume}>Resume</button>
          : <button className="btn btn-ghost" style={{flex:1,minHeight:40,fontSize:12,color:'var(--warn)'}} onClick={onFinish}>Finish cycle</button>}
      </div>
    </div>
  );
}

function compoundFingerprint(p) {
  if (!p) return '';
  const ing = p.ingredients || { [p.id]: 1 };
  const sorted = Object.entries(ing).sort((a,b) => a[0].localeCompare(b[0]));
  return sorted.map(([k, v]) => `${k}:${parseFloat(v).toFixed(3)}`).join('|');
}

function getEquivalentIds(peptideId) {
  const p = findPep(peptideId);
  if (!p) return [peptideId];
  const fp = compoundFingerprint(p);
  return PEPTIDE_DB.filter(x => compoundFingerprint(x) === fp).map(x => x.id);
}



// Profile-aware filtering: items belong to a specific profile (Tim) or are shared (others)
function isItemVisibleToProfile(item, profile) {
  const itemProfile = item.inventoryProfile;
  if (SEPARATE_INVENTORY_PROFILES.includes(profile)) return itemProfile === profile;
  return !itemProfile || !SEPARATE_INVENTORY_PROFILES.includes(itemProfile);
}
function getInventoryProfile(profile) {
  return SEPARATE_INVENTORY_PROFILES.includes(profile) ? profile : null;
}
function describeCompound(p) {
  if (!p) return '';
  if (!p.ingredients) return p.name;
  const parts = Object.entries(p.ingredients).sort((a,b) => b[1] - a[1]).map(([k,v]) => {
    const sub = findPep(k);
    return `${(v*100).toFixed(0)}% ${sub ? sub.name.split(' ')[0] : k}`;
  });
  return parts.join(' · ');
}

function vialMath(totalMg, totalMl, doseMcg) {
  if (!totalMg || !totalMl) return null;
  const totalMcg = totalMg * 1000;
  const mcgPerMl = totalMcg / totalMl;
  const mcgPerUnit = mcgPerMl / 100;
  const volPerDose = doseMcg ? doseMcg / mcgPerMl : 0;
  const unitsPerDose = volPerDose * 100;
  const totalDoses = doseMcg ? Math.floor(totalMcg / doseMcg) : 0;
  return { totalMcg, mcgPerMl, mcgPerUnit, volPerDose, unitsPerDose, totalDoses };
}


function SyncConfig({ initialUrl, initialToken, onSave, onClose }) {
  const [u, setU] = useState(initialUrl || '');
  const [t, setT] = useState(initialToken || '');
  return (
    <div>
      <h3 style={{margin:'0 0 6px',fontSize:18,fontWeight:700}}>☁️ Cloud Sync Setup</h3>
      <p style={{margin:'0 0 14px',fontSize:13,color:'var(--text-dim)'}}>Connect once. After this, your protocol auto-syncs across every device + Claude — no files.</p>
      <label style={{fontSize:12,fontWeight:600,color:'var(--text-dim)'}}>Worker URL</label>
      <input value={u} onChange={e=>setU(e.target.value)} placeholder="https://protocol-sync.<you>.workers.dev"
        autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="url"
        style={{width:'100%',padding:'10px',margin:'4px 0 12px',borderRadius:10,border:'1px solid var(--border)',background:'rgba(255,255,255,0.04)',color:'var(--text)',fontSize:14}}/>
      <label style={{fontSize:12,fontWeight:600,color:'var(--text-dim)'}}>Sync token</label>
      <input value={t} onChange={e=>setT(e.target.value)} placeholder="your SYNC_TOKEN secret"
        autoCapitalize="none" autoCorrect="off" spellCheck={false}
        style={{width:'100%',padding:'10px',margin:'4px 0 16px',borderRadius:10,border:'1px solid var(--border)',background:'rgba(255,255,255,0.04)',color:'var(--text)',fontSize:14}}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={()=>onSave(u.trim(),t.trim())} disabled={!u||!t}>Connect</button>
      </div>
    </div>
  );
}

// ===== SYNC-CORE-BEGIN (portable; Node + browser) =====
// Conflict-free enough for one person's phones: every entry carries updatedAt, deletions leave a dated
// marker in meta.tombstones, and a merge takes the newest copy of each id while honouring the markers.
const nowIso = () => new Date().toISOString();
const SyncCore = {
  KINDS: ['protocols', 'vials', 'logs'],
  TOMB_DAYS: 90,
  bodyOf(o) { const c = { ...o }; delete c.updatedAt; return JSON.stringify(c); },
  snapshot(state) {
    const snap = {};
    SyncCore.KINDS.forEach(k => { const m = {}; (state[k] || []).forEach(o => { if (o && o.id != null) m[o.id] = { j: SyncCore.bodyOf(o), at: o.updatedAt || null }; }); snap[k] = m; });
    return snap;
  },
  tombsOf(meta) { const t = (meta && meta.tombstones) || {}; const out = {}; SyncCore.KINDS.forEach(k => { out[k] = { ...(t[k] || {}) }; }); return out; },
  // state + the snapshot of the last sync → stamped state (changed entries get updatedAt = now, vanished ids get a marker)
  prepare(state, base, now) {
    const tomb = SyncCore.tombsOf(state.meta);
    let changed = false; const out = {};
    SyncCore.KINDS.forEach(k => {
      const b = base ? base[k] : null; const seen = new Set(); let arrChanged = false;
      const arr = (state[k] || []).map(o => {
        if (!o || o.id == null) return o;
        seen.add(String(o.id));
        if (tomb[k][o.id]) { delete tomb[k][o.id]; changed = true; }   // back after a deletion: the marker goes
        const prev = b ? b[o.id] : null;
        if (o.updatedAt && (!prev || prev.j === SyncCore.bodyOf(o))) return o; // stamped, and either unchanged since the last sync or arrived stamped (merge, import)
        arrChanged = true; return { ...o, updatedAt: now };              // changed, or a legacy row that never had a stamp
      });
      if (b) Object.keys(b).forEach(id => { if (!seen.has(String(id))) { tomb[k][id] = now; changed = true; } });
      out[k] = arrChanged ? arr : (state[k] || []); if (arrChanged) changed = true;
    });
    const cutoff = new Date(Date.parse(now) - SyncCore.TOMB_DAYS * 864e5).toISOString();
    SyncCore.KINDS.forEach(k => Object.keys(tomb[k]).forEach(id => { if (tomb[k][id] < cutoff) { delete tomb[k][id]; changed = true; } }));
    out.meta = changed ? { ...(state.meta || {}), tombstones: tomb } : (state.meta || {});
    out.changed = changed;
    return out;
  },
  // two stamped states → one: newest updatedAt wins per id (ties and unstamped rows stay local), a dated
  // delete marker beats any copy not re-created after it, local order is kept and remote-only rows appended
  merge(local, remote) {
    const tl = SyncCore.tombsOf(local.meta), tr = SyncCore.tombsOf(remote.meta), tomb = {};
    SyncCore.KINDS.forEach(k => { tomb[k] = { ...tl[k] }; Object.keys(tr[k]).forEach(id => { if (!tomb[k][id] || tr[k][id] > tomb[k][id]) tomb[k][id] = tr[k][id]; }); });
    const out = {};
    SyncCore.KINDS.forEach(k => {
      const L = local[k] || [], R = remote[k] || [];
      const rIdx = {}; R.forEach(o => { if (o && o.id != null) rIdx[o.id] = o; });
      const lIds = new Set(); const arr = [];
      const keep = (o) => { const t = tomb[k][o.id]; return !(t && !(o.updatedAt && o.updatedAt > t)); };
      L.forEach(a => {
        if (!a || a.id == null) { arr.push(a); return; }
        lIds.add(String(a.id));
        const b = rIdx[a.id];
        const pick = (b && (b.updatedAt || '') > (a.updatedAt || '')) ? b : a;
        if (keep(pick)) arr.push(pick);
      });
      R.forEach(b => { if (!b || b.id == null || lIds.has(String(b.id))) return; if (keep(b)) arr.push(b); });
      out[k] = arr;
    });
    const lm = local.meta || {}, rm = remote.meta || {};
    const mig = Array.from(new Set([...(Array.isArray(rm.migrations) ? rm.migrations : []), ...(Array.isArray(lm.migrations) ? lm.migrations : [])]));
    out.meta = { ...rm, ...lm, migrations: mig, tombstones: tomb };
    return out;
  },
  // import files: shape check + per-row validation; nothing is ever replaced wholesale
  validateImport(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok: false, reason: 'this is not a Protocol OS file' };
    const fmt = String(d._format || '');
    const anyArr = Array.isArray(d.protocols) || Array.isArray(d.logs) || Array.isArray(d.vials);
    if (!/^protocol-os-(export|logs)\//.test(fmt) && !anyArr) return { ok: false, reason: 'no format marker and no protocols, vials or logs inside' };
    let skipped = 0;
    const take = (arr, pred) => Array.isArray(arr) ? arr.filter(o => { const ok = !!pred(o); if (!ok) skipped++; return ok; }) : [];
    const protocols = take(d.protocols, o => o && typeof o === 'object' && o.id != null && (o.peptideId || o.peptideName) && (o.schedule || o.timeline));
    const vials = take(d.vials, o => o && typeof o === 'object' && o.id != null);
    const logs = take(d.logs, o => o && typeof o === 'object' && o.id != null && typeof o.datetime === 'string');
    if (!protocols.length && !vials.length && !logs.length) return { ok: false, reason: 'no usable protocols, vials or log entries' + (skipped ? ` (${skipped} malformed)` : '') };
    return { ok: true, protocols, vials, logs, skipped };
  },
  upsert(prev, incoming) { const m = new Map(); (prev || []).forEach(o => { if (o && o.id != null) m.set(String(o.id), o); }); const extra = (prev || []).filter(o => !o || o.id == null); incoming.forEach(o => m.set(String(o.id), o)); return [...extra, ...m.values()]; },
};
// ===== SYNC-CORE-END =====

function App() {
  const [logs, setLogs] = useState([]);
  const [vials, setVials] = useState([]);
  const [protocols, setProtocols] = useState([]);
  // meta travels in the sync payload: { migrations: [ids already applied to this blob] }
  const [meta, setMeta] = useState(() => { try { return JSON.parse(localStorage.getItem('protocol_os_meta') || '{}') || {}; } catch (e) { return {}; } });
  const [activeTab, setActiveTab] = useState('protocol');
  const [activeProfile, setActiveProfile] = useState(() => localStorage.getItem('protocol_os_active_profile') || 'Roman');
  const [viewDate, setViewDate] = useState(() => new Date());
  const [jumpTo, setJumpTo] = useState(null);   // History → Protocol hand-off: { dateKey, protocolId, logId }
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  // Always-current mirrors for async paths (cloud pull lands while a sheet/closure holds stale state).
  const protocolsRef = useRef(protocols); protocolsRef.current = protocols;
  const logsRef = useRef(logs); logsRef.current = logs;
  const vialsRef = useRef(vials); vialsRef.current = vials;
  // D5 sheet physics: mounted-through-exit. content stays mounted while .closing runs;
  // openModal/closeModal keep their names + signatures (dozens of call sites).
  const [sheet, setSheet] = useState({ content: null, open: false, closing: false, settled: false });
  const sheetTimer = useRef(null);
  const sheetRef = useRef(null);       // C5 a11y: sheet element, focused on open
  const prevFocusRef = useRef(null);   // C5 a11y: element to restore focus to on close

  useEffect(() => {
    try {

      let storedLogs = (JSON.parse(localStorage.getItem('protocol_os_logs') || '[]')).map(canonicalizeDose);
      let storedVials = JSON.parse(localStorage.getItem('protocol_os_vials') || '[]');
      let storedProtocols = (JSON.parse(localStorage.getItem('protocol_os_protocols') || '[]')).map(canonicalizeDose);
      // With sync configured the cloud record is the truth and migrations run after the first pull.
      const seedsAllowed = !(localStorage.getItem('protocol_os_sync_url') && localStorage.getItem('protocol_os_sync_token'));

      const v4Done = localStorage.getItem('protocol_os_loaded_v4');
      if (!v4Done) { try { localStorage.setItem('protocol_os_loaded_v4', 'true'); } catch (e2) {} } // a fresh install starts empty: no demo data (the empty state's Add first compound takes over)
      // Without cloud sync the local store is the truth: run one-time migrations here. With sync,
      // they run after the first successful pull (cloud blob wins, see cloudPull).
      if (seedsAllowed) {
        let storedMeta = {}; try { storedMeta = JSON.parse(localStorage.getItem('protocol_os_meta') || '{}') || {}; } catch (e2) {}
        const m = runMigrations({ protocols: storedProtocols, logs: storedLogs, vials: storedVials, meta: storedMeta }, activeProfile, todayLocal());
        storedProtocols = m.protocols; storedLogs = m.logs; if (m.changed) setMeta(m.meta);
      }
      setLogs(storedLogs);
      setVials(storedVials);
      setProtocols(materializeAll(storedProtocols, todayLocal()));
    } catch (e) { console.error(e); }
  }, []);
  // Re-materialize when the app comes back to the foreground or the hour ticks over (a dated plan
  // change or a cycle end may have become effective while the PWA was suspended).
  useEffect(() => {
    const tick = () => setProtocols(prev => { const n = materializeAll(prev, todayLocal()); return n === prev ? prev : n; });
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(tick, 60 * 60 * 1000);
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(t); };
  }, []);
  // Guarded persistence: a full or blocked store must never unmount the app (a QuotaExceededError thrown
  // inside these effects used to white-screen it and lose the entry just made). On failure the state stays
  // in memory, a banner asks for an export, and the cloud push (when configured) still runs.
  const [storageFull, setStorageFull] = useState(false);
  const persist = (key, value) => { try { localStorage.setItem(key, value); if (storageFull) setStorageFull(false); } catch (e) { console.error('persist ' + key, e); setStorageFull(true); } };
  useEffect(() => { persist('protocol_os_meta', JSON.stringify(meta || {})); }, [meta]);
  useEffect(() => { persist('protocol_os_logs', JSON.stringify(logs)); }, [logs]);
  useEffect(() => { persist('protocol_os_vials', JSON.stringify(vials)); }, [vials]);
  useEffect(() => { persist('protocol_os_protocols', JSON.stringify(protocols)); }, [protocols]);
  useEffect(() => { persist('protocol_os_active_profile', activeProfile); }, [activeProfile]);
  // Text size: a zoom token on the root (1 / 1.15 / 1.3), remembered per device.
  const [textScale, setTextScale] = useState(() => { try { return localStorage.getItem('protocol_os_text_scale') || '1'; } catch (e) { return '1'; } });
  useEffect(() => { document.documentElement.style.setProperty('--ts', textScale); persist('protocol_os_text_scale', textScale); }, [textScale]);

  // ── Cloud sync (Cloudflare Worker + KV): auto-sync everywhere, no files ──
  const [syncUrl, setSyncUrl] = useState(() => localStorage.getItem('protocol_os_sync_url') || '');
  const [syncToken, setSyncToken] = useState(() => localStorage.getItem('protocol_os_sync_token') || '');
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | pushing | pulling | ok | error | off
  const syncReady = syncUrl && syncToken;
  const lastPushRef = React.useRef('');      // JSON of the state the cloud is known to hold — set after a 2xx or a pull, never before
  const pulledOnce = React.useRef(false);    // never push before the first successful pull (a fresh browser must not overwrite the cloud)
  const cloudRev = React.useRef(null);       // last seen rev (from response BODIES) — sent back as If-Match on every write
  const pushFails = React.useRef(0);         // consecutive push failures (drives backoff)
  const pushBlockedUntil = React.useRef(0);  // epoch ms before which auto-pushes are skipped
  const pullTries = React.useRef(0);         // launch-pull retries (2 s, 8 s, 30 s)
  const syncBase = React.useRef(null);       // snapshot of the last synced state: diffed to stamp updatedAt and to write delete markers
  const [syncQueued, setSyncQueued] = useState(false); // a push failed and is waiting for retry/reconnect
  const metaRef = useRef(meta); metaRef.current = meta;

  // ONE shared cloud record for every profile: the whole store travels under ?profile=all, so a profile
  // switch can no longer merge against a stale snapshot of someone else's key (the P0 of the Oct 2 audit).
  // Token travels in the Authorization header; never in the URL.
  const cloudEndpoint = () => `${syncUrl.replace(/\/+$/, '')}/sync?profile=all`;
  const authHeaders = () => ({ 'Authorization': 'Bearer ' + syncToken });
  const withToday = (s) => ({ ...s, protocols: materializeAll(s.protocols, todayLocal()) });
  const payloadOf = (s) => JSON.stringify({ protocols: s.protocols, vials: s.vials, storage: [], logs: s.logs, meta: s.meta }); // storage retired (inventory removed) — empty array keeps the worker schema stable
  const remoteOf = (d) => ({ protocols: (Array.isArray(d.protocols) ? d.protocols : []).map(canonicalizeDose), vials: Array.isArray(d.vials) ? d.vials : [], logs: (Array.isArray(d.logs) ? d.logs : []).map(canonicalizeDose), meta: (d.meta && typeof d.meta === 'object') ? d.meta : {} });
  const applyState = (s) => { setProtocols(s.protocols); setVials(s.vials); setLogs(s.logs); setMeta(s.meta); protocolsRef.current = s.protocols; vialsRef.current = s.vials; logsRef.current = s.logs; metaRef.current = s.meta; };
  // Stamp what changed since the last sync (updatedAt), record what disappeared (delete markers in meta),
  // write the stamps back into state and return the prepared state. Idempotent.
  const prepareLocal = () => {
    const cur = { protocols: protocolsRef.current, vials: vialsRef.current, logs: logsRef.current, meta: metaRef.current };
    const out = SyncCore.prepare(cur, syncBase.current, nowIso());
    if (out.changed) applyState(out);
    return out;
  };

  const cloudPull = async (announce) => {
    if (!syncReady) return;
    setSyncStatus('pulling');
    try {
      const r = await fetch(cloudEndpoint(), { method: 'GET', headers: authHeaders() });
      if (!r.ok) throw new Error('GET ' + r.status);
      const d = await r.json();
      // Rev comes from the BODY (_rev): Cloudflare rewrites ETags to weak (W/"n") when it
      // compresses responses, which poisoned If-Match and 409'd every push from Safari.
      if (d && d._rev != null) cloudRev.current = String(d._rev);
      else { const etag = r.headers.get('ETag'); if (etag) cloudRev.current = etag.replace(/^W\//, '').replace(/"/g, ''); }
      pulledOnce.current = true; pullTries.current = 0;
      const todayDk = todayLocal();
      const local = prepareLocal();
      let next = local, remote = null;
      if (!d._empty) { remote = withToday(remoteOf(d)); next = SyncCore.merge(local, remote); } // newest wins per entry; deletions stay deleted
      // One-time migrations run against the MERGED state with the merged marker list.
      const m = runMigrations({ protocols: next.protocols, logs: next.logs, vials: next.vials, meta: next.meta }, activeProfile, todayDk);
      next = withToday({ protocols: m.protocols, logs: m.logs, vials: next.vials, meta: m.meta });
      applyState(next);
      // The cloud's current content counts as already pushed: if the merge changed nothing locally the
      // store is never re-uploaded on launch; if it did, the debounced push sends the difference.
      syncBase.current = SyncCore.snapshot(next);
      lastPushRef.current = remote ? payloadOf(remote) : '';
      setSyncStatus('ok');
      if (announce) showToast('Pulled latest from cloud');
    } catch (e) {
      console.error(e); setSyncStatus('error');
      if (!pulledOnce.current && pullTries.current < 3) { // a dead-spot launch must not kill sync for the whole session
        const delay = [2000, 8000, 30000][pullTries.current]; pullTries.current += 1;
        setTimeout(() => { if (!pulledOnce.current) cloudPull(false); }, delay);
      }
      if (announce) showToast('Sync failed: ' + (e.message||e) + ' — check URL/token in ⋯ settings', 'error');
    }
  };

  const cloudPush = async (announce, force) => {
    if (!syncReady) return;
    if (!pulledOnce.current) { if (announce) showToast('Fetching the cloud copy first…'); return; }
    const s = prepareLocal();
    const payload = payloadOf(s);
    if (payload === lastPushRef.current) { if (announce) { setSyncQueued(false); setSyncStatus('ok'); showToast('Already in sync'); } return; } // no change
    if (!announce && !force && Date.now() < pushBlockedUntil.current) return; // failure backoff (manual taps and reconnects bypass)
    setSyncStatus('pushing');
    const doPost = (body, rev) => fetch(cloudEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(rev ? { 'If-Match': '"' + rev + '"' } : {}) },
      body,
    });
    try {
      let sent = s, sentPayload = payload;
      let r = await doPost(payload, cloudRev.current);
      if (r.status === 409) {
        // Stale rev: another writer got there first. Read the server's rev from the 409 BODY (never
        // headers — Cloudflare weakens ETags under compression), merge newest-wins per entry with
        // delete markers honoured, and retry once.
        let conflict = null; try { conflict = await r.json(); } catch {}
        const g = await fetch(cloudEndpoint(), { method: 'GET', headers: authHeaders() });
        if (!g.ok) throw new Error('GET-on-409 ' + g.status);
        const server = await g.json();
        cloudRev.current = String((server && server._rev != null) ? server._rev
          : (conflict && conflict.currentRev != null) ? conflict.currentRev : '');
        sent = (server && !server._empty) ? withToday(SyncCore.merge(s, withToday(remoteOf(server)))) : s;
        applyState(sent);
        sentPayload = payloadOf(sent);
        r = await doPost(sentPayload, cloudRev.current || null);
      }
      if (!r.ok) throw new Error('POST ' + r.status);
      let ok = null; try { ok = await r.json(); } catch {}
      if (ok && ok.rev != null) cloudRev.current = String(ok.rev);
      syncBase.current = SyncCore.snapshot(sent);
      lastPushRef.current = sentPayload; // only now does the cloud hold it
      pushFails.current = 0;
      setSyncQueued(false);
      setSyncStatus('ok');
      if (announce) showToast('Synced to cloud');
    } catch (e) {
      // Backoff: consecutive failures stop auto-retrying (30s, 1m, 2m, 4m, cap 5m) so a
      // persistent rejection can never become a request storm. Manual taps and reconnects bypass it.
      pushFails.current += 1;
      pushBlockedUntil.current = Date.now() + Math.min(300000, 30000 * Math.pow(2, pushFails.current - 1));
      console.error(e); setSyncStatus('error'); setSyncQueued(true);
      if (announce) showToast('Cloud sync failed — will retry when online', 'error');
    }
  };

  // Pull once on load when configured
  useEffect(() => { if (syncReady) cloudPull(false); /* eslint-disable-next-line */ }, []);
  // Debounced auto-push whenever data changes
  useEffect(() => {
    if (!syncReady) { setSyncStatus('off'); return; }
    const t = setTimeout(() => cloudPush(false), 1500);
    return () => clearTimeout(t);
  }, [protocols, vials, logs, meta, syncUrl, syncToken]);
  // Reconnect: when the network returns OR the app is foregrounded, finish the launch pull if it never
  // landed, otherwise send what is queued (iOS PWAs suspend in the background; 'online' alone can miss it).
  useEffect(() => {
    const retry = () => { if (!syncReady) return; if (!pulledOnce.current) cloudPull(false); else if (syncQueued) cloudPush(false, true); };
    const onVis = () => { if (document.visibilityState === 'visible') retry(); };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('online', retry); document.removeEventListener('visibilitychange', onVis); };
  });

  const saveSyncConfig = (u, tok) => {
    setSyncUrl(u); setSyncToken(tok);
    persist('protocol_os_sync_url', u);
    persist('protocol_os_sync_token', tok);
    showToast('Cloud sync configured');
  };

  // ── Claude sync: Export (adherence + full state out) / Import (protocol in) ──
  const exportData = () => {
    const payload = {
      _format: 'protocol-os-export/v1',
      exportedAt: new Date().toISOString(),
      activeProfile,
      protocols, vials, storage: [], meta,
      logs, // daily adherence — this is what the peptide-tracker skill reads
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protocol-os-export-${todayLocal()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast('Exported — share the JSON with Claude');
  };
  // ── Log downloads (History tab + Data & sync). CSV opens in Excel/Numbers/Sheets; JSON is the raw log shape. ──
  const downloadText = (name, text, type) => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const logsToCSV = (list) => {
    const esc = (s) => { s = (s == null ? '' : String(s)); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; /* a note starting with = + - @ must not become a formula in Excel/Numbers */ return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
    const rows = [['Date','Time','Compound','Dose','Unit','Syringe units','mL','Status','Site','Notes','Profile','Entry id']];
    list.forEach(l => {
      const dt = new Date(l.datetime);
      const isIUx = l.doseUnit === 'IU';
      const isG = !isIUx && l.doseUnit === 'g';
      const isMg = !isIUx && !isG && (l.doseUnit === 'mg' || (l.doseMcg != null && l.doseMcg >= 1000));
      const dose = l.skipped ? '' : isIUx ? (l.doseValue != null ? l.doseValue : l.doseMcg) : isG ? l.doseMcg/1e6 : isMg ? l.doseMcg/1000 : l.doseMcg;
      const unit = l.skipped ? '' : isIUx ? 'IU' : isG ? 'g' : isMg ? 'mg' : 'mcg';
      const u = l.doseMl != null ? (l.doseMl * 100).toFixed(1) : '';
      const status = l.skipped ? 'skipped' : (l.backfilled ? 'logged (back-dated)' : 'logged') + (l.needsReview ? ' · flagged' : '');
      rows.push([isNaN(dt) ? (l.datetime || '') : dt.toLocaleDateString('en-CA'), isNaN(dt) ? '' : dt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
        l.peptide || l.peptideName || l.peptideId || '', dose != null ? dose : '', unit, u, l.doseMl != null ? l.doseMl : '', status, l.site || '', l.notes || '', l.profile || activeProfile, l.id || '']);
    });
    return rows.map(r => r.map(esc).join(',')).join('\n');
  };
  const myLogsSorted = (includeSkipped) => logs.filter(l => (l.profile || activeProfile) === activeProfile && (includeSkipped || !l.skipped))
    .slice().sort((a,b) => (b.datetime || '').localeCompare(a.datetime || ''));
  const exportHistoryCSV = (list) => {
    const mine = Array.isArray(list) ? list : myLogsSorted(false);
    downloadText(`protocol-os-history-${activeProfile}-${todayLocal()}.csv`, '﻿' + logsToCSV(mine), 'text/csv;charset=utf-8;');
    showToast(`Downloaded ${mine.length} entries · CSV (${activeProfile})`);
  };
  const exportHistoryJSON = (list) => {
    const mine = Array.isArray(list) ? list : myLogsSorted(true);
    downloadText(`protocol-os-logs-${activeProfile}-${todayLocal()}.json`, JSON.stringify({ _format: 'protocol-os-logs/v1', exportedAt: new Date().toISOString(), profile: activeProfile, count: mine.length, logs: mine }, null, 2), 'application/json');
    showToast(`Downloaded ${mine.length} entries · JSON (${activeProfile})`);
  };
  const importInputRef = React.useRef(null);
  const handleImportFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let d;
      try { d = JSON.parse(reader.result); } catch (err) { return showToast('Import failed — not a JSON file', 'error'); }
      const check = SyncCore.validateImport(d);
      if (!check.ok) return showToast('Import refused: ' + check.reason, 'error');
      const { protocols: inP, vials: inV, logs: inL } = check;
      const byProfile = {}; inP.forEach(p => { const k = p.profile || '?'; byProfile[k] = (byProfile[k] || 0) + 1; });
      const parts = [];
      if (inP.length) parts.push(`${inP.length} protocol${inP.length === 1 ? '' : 's'} (${Object.entries(byProfile).map(([k, v]) => k + ' ' + v).join(', ')})`);
      if (inV.length) parts.push(`${inV.length} vial${inV.length === 1 ? '' : 's'}`);
      if (inL.length) parts.push(`${inL.length} log entr${inL.length === 1 ? 'y' : 'ies'}`);
      const summary = parts.join(', ');
      confirmModal('Import this file?', `It holds ${summary}. Entries with the same id replace yours; everything else is kept. A backup of the current data is saved first.${check.skipped ? ` ${check.skipped} malformed entr${check.skipped === 1 ? 'y is' : 'ies are'} skipped.` : ''}`, () => {
        try { localStorage.setItem('protocol_os_backup', JSON.stringify({ at: new Date().toISOString(), protocols: protocolsRef.current, vials: vialsRef.current, logs: logsRef.current, meta: metaRef.current })); }
        catch (err) { return showToast('Import stopped — no room for a backup. Export first, then free space.', 'error'); }
        const now = nowIso();
        const stamp = (o) => ({ ...o, updatedAt: now });
        const todayDk = todayLocal();
        if (inP.length) setProtocols(prev => materializeAll(SyncCore.upsert(prev, inP.map(canonicalizeDose).map(stamp)), todayDk));
        if (inV.length) setVials(prev => SyncCore.upsert(prev, inV.map(stamp)));
        if (inL.length) setLogs(prev => SyncCore.upsert(prev, inL.map(canonicalizeDose).map(stamp)));
        if (d.meta && typeof d.meta === 'object' && Array.isArray(d.meta.migrations)) setMeta(prev => ({ ...prev, migrations: Array.from(new Set([...(Array.isArray(prev.migrations) ? prev.migrations : []), ...d.meta.migrations])) }));
        showToast(`Imported ${summary}`);
      }, 'Import');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const showToast = (message, type = 'success', undoFn = null) => {
    setToast({ message, type, undoFn });
    // One timer at a time: a quick second toast used to be cleared early by the first toast's timer.
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => { toastTimer.current = null; setToast(null); }, undoFn ? 6000 : 3000);
  };
  const openModal = (content) => {
    if (sheetTimer.current) { clearTimeout(sheetTimer.current); sheetTimer.current = null; }
    setSheet(s => (s.content && !s.closing)
      ? { ...s, content }                                            // content swap while open — do NOT replay entrance
      : { content, open: false, closing: false, settled: false });   // fresh mount; effect below rAF-adds .open
  };
  const closeModal = () => {
    setSheet(s => s.content ? { ...s, open: false, closing: true, settled: false } : s);
    if (sheetTimer.current) clearTimeout(sheetTimer.current);
    sheetTimer.current = setTimeout(() => { sheetTimer.current = null; setSheet({ content: null, open: false, closing: false, settled: false }); }, 380);
  };
  // Present: mount at translateY(103%), then double-rAF adds .open so the transition runs.
  useEffect(() => {
    if (sheet.content && !sheet.open && !sheet.closing) {
      let r2 = null;
      const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setSheet(s => (s.content && !s.closing) ? { ...s, open: true } : s)); });
      return () => { cancelAnimationFrame(r1); if (r2 != null) cancelAnimationFrame(r2); };
    }
  }, [sheet.content, sheet.open, sheet.closing]);
  // C5 a11y: move focus into the dialog on open; hand it back on close. Content swaps
  // while open (e.g. GateDialog) keep focus where it is — the boolean dep only flips on
  // mount/unmount of the sheet itself.
  useEffect(() => {
    if (sheet.content) {
      if (!prevFocusRef.current && document.activeElement && document.activeElement !== document.body) prevFocusRef.current = document.activeElement;
      if (sheetRef.current) sheetRef.current.focus({ preventScroll: true });
    } else {
      const el = prevFocusRef.current; prevFocusRef.current = null;
      if (el && document.contains(el) && el.focus) el.focus({ preventScroll: true });
      else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }
  }, [!!sheet.content]);
  // C5 a11y: Escape dismisses the sheet while it is open.
  useEffect(() => {
    if (!sheet.content) return;
    const onKey = (e) => {
      if (e.key === 'Escape') return closeModal();
      if (e.key !== 'Tab' || !sheetRef.current) return;   // keep keyboard focus inside the open sheet
      const f = Array.from(sheetRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sheetRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [!!sheet.content]);
  const confirmModal = (title, body, onConfirm, okText = 'Confirm') => {
    openModal(
      <div>
        <div style={{display:'flex',gap:6,alignItems:'flex-start',marginBottom:20}}>
          <div style={{width:44,height:44,borderRadius:14,background:'rgba(255,69,58,0.12)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><AlertTriangle size={20} color="#FF453A"/></div>
          <div><h3 style={{margin:0,fontSize:19,fontWeight:700}}>{title}</h3><p style={{margin:'6px 0 0',fontSize:14,color:'var(--text-dim)'}}>{body}</p></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { closeModal(); onConfirm(); }}>{okText}</button>
        </div>
      </div>
    );
  };

  const dateKey = `${viewDate.getFullYear()}-${String(viewDate.getMonth()+1).padStart(2,'0')}-${String(viewDate.getDate()).padStart(2,'0')}`;
  const isToday = dateKey === todayLocal();
  const isPast = dateKey < todayLocal();
  const isFuture = dateKey > todayLocal();

  // ── D3 header: adherence ring + week-strip data — same schedule engine as the day list ──
  const headerProtos = protocols.filter(p => p.profile === activeProfile);
  const dueProtosOn = (dk) => headerProtos.filter(p => activeOn(p, dk)).map(p => protoAt(p, dk)).filter(p => !isPrnSched(p.schedule) && dueOn(p, dk));
  const headerHasLog = (p, dk) => logs.some(l => l.protocolId === p.id && (l.datetime||'').slice(0,10) === dk && !l.skipped);
  const headerDue = dueProtosOn(dateKey);
  const headerScheduled = headerDue.length;
  const headerLogged = headerDue.filter(p => headerHasLog(p, dateKey)).length;
  const weekStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() - viewDate.getDay());
  const weekDays = Array.from({length: 7}, (_, i) => {
    const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
    const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const sched = dueProtosOn(dk);
    const hasSched = sched.length > 0;
    const allLogged = hasSched && sched.every(p => headerHasLog(p, dk));
    return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), key: dk, num: d.getDate(),
      letter: d.toLocaleDateString(undefined, {weekday:'narrow'}),
      isSel: dk === dateKey, isToday: dk === todayLocal(), hasSched, allLogged,
      aria: d.toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric'}) };
  });
  const switchProfile = (p) => { if (p === activeProfile) return; setActiveProfile(p); showToast('Now viewing ' + p); };
  // Library and the reconstitution calculator live in sheets now (Plan tab and profile menu), not in the tab bar.
  const openLibrary = () => openModal(<LabView vials={vials}/>);
  const openCalculator = () => openModal(<MathView/>);
  const openSyncConfigModal = (pullAfter) => openModal(
    <SyncConfig initialUrl={syncUrl} initialToken={syncToken}
      onSave={(u,t)=>{ saveSyncConfig(u,t); closeModal(); if (pullAfter) setTimeout(()=>cloudPull(true),300); }}
      onClose={closeModal}/>
  );
  const openDataSyncModal = () => openModal(
    <div>
      <h3 style={{margin:'0 0 12px',fontSize:17,fontWeight:700}}>{'Data & sync'}</h3>
      <div style={{display:'flex',gap:8,marginBottom:10}}>
        <button className="btn btn-ghost" style={{flex:1}} onClick={()=>{exportData();}}>Export file</button>
        <button className="btn btn-ghost" style={{flex:1}} onClick={()=>importInputRef.current&&importInputRef.current.click()}>Import file</button>
      </div>
      <div style={{display:'flex',gap:8,marginBottom:10}}>
        <button className="btn btn-ghost" style={{flex:1}} onClick={()=>{exportHistoryCSV();}}>History CSV</button>
        <button className="btn btn-ghost" style={{flex:1}} onClick={()=>{exportHistoryJSON();}}>History JSON</button>
      </div>
      {syncReady
        ? <button className="btn btn-ghost" style={{width:'100%',fontSize:12}} onClick={()=>openSyncConfigModal(false)}>Edit cloud sync settings</button>
        : <button className="btn btn-ghost" style={{width:'100%',fontSize:12}} onClick={()=>openSyncConfigModal(true)}>Set up cloud sync</button>}
    </div>
  );

  return (
    <div style={{position:'relative',minHeight:'100vh'}}>
      <div className="ambient"/>
      <div {...(sheet.content ? { inert: '' } : {})}>
      <AppHeader
        viewDate={viewDate} setViewDate={setViewDate} isToday={isToday}
        activeProfile={activeProfile} setActiveProfile={switchProfile} protocols={protocols}
        logged={headerLogged} scheduled={headerScheduled} weekDays={weekDays}
        syncReady={syncReady} syncStatus={syncStatus} syncQueued={syncQueued}
        onSyncTap={() => {
          if (!syncReady) return openSyncConfigModal(true);
          // Nothing pulled yet (the launch pull failed) or an error: pull first, then send what is queued.
          if (!pulledOnce.current || syncStatus === 'error') { cloudPull(true).then(() => cloudPush(false, true)); }
          else if (syncQueued) { cloudPush(true, true); } else { cloudPull(true); }
        }}
        onOpenDataSync={openDataSyncModal} onOpenLibrary={openLibrary} onOpenCalculator={openCalculator} textScale={textScale} setTextScale={setTextScale}/>
      <input ref={importInputRef} type="file" accept="application/json,.json" style={{display:'none'}} onChange={handleImportFile}/>
      {storageFull && <div role="alert" className="storage-banner"><span>Storage is full. New entries are kept in memory only until space is freed.</span><button onClick={exportData}>Export now</button></div>}
      {!isToday && activeTab === 'protocol' && <div style={{position:'relative',zIndex:2,maxWidth:480,margin:'0 auto',padding:'10px 18px 0'}}><button className="viewing-pill" onClick={() => setViewDate(new Date())}>Viewing {fmtDk(dateKey)} · Back to today</button></div>}
      <div style={{position:'relative',zIndex:1,maxWidth:480,margin:'0 auto',padding:'12px 18px 0'}}>
        <div className="anim-fade-in" key={activeTab + dateKey + activeProfile}>
          {(activeTab === 'protocol' || activeTab === 'plan') && <ProtocolView mode={activeTab === 'plan' ? 'plan' : 'today'} openLibrary={openLibrary} openCalculator={openCalculator} viewDate={viewDate} dateKey={dateKey} isFuture={isFuture} activeProfile={activeProfile} protocols={protocols} setProtocols={setProtocols} vials={vials} setVials={setVials} logs={logs} setLogs={setLogs} openModal={openModal} closeModal={closeModal} confirmModal={confirmModal} showToast={showToast} jumpTo={jumpTo} clearJump={() => setJumpTo(null)}/>}
          {activeTab === 'history' && <HistoryView logs={logs} setLogs={setLogs} protocols={protocols} vials={vials} activeProfile={activeProfile} openModal={openModal} closeModal={closeModal} confirmModal={confirmModal} showToast={showToast} exportCSV={exportHistoryCSV} exportJSON={exportHistoryJSON}
            onJump={(dk, protocolId, logId) => { const t = dkParse(dk); if (!isNaN(t)) { const d = new Date(t); setViewDate(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); } setJumpTo({ dateKey: dk, protocolId, logId }); setActiveTab('protocol'); }}/>}
        </div>
      </div>

      <div className="pill-nav-wrap">
        <div className="pill-nav">
          {[['protocol','Today'],['plan','Plan'],['history','History']].map(([id,label]) => (
            <button key={id} onClick={() => setActiveTab(id)} className={`pill-nav-item ${activeTab===id?'active':''}`}>
              <NavIcon id={id} color={activeTab===id?'var(--accent)':'var(--text-faint)'}/><span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      </div>
      {toast && (
        <div role="status" aria-live="polite" style={{position:'fixed',bottom:'calc(100px + env(safe-area-inset-bottom))',left:'50%',transform:'translateX(-50%)',zIndex:200}} className="anim-slide-up">
          <div className="glass-strong" style={{borderRadius:100,padding:'12px 18px',display:'flex',gap:10,alignItems:'center',boxShadow:'0 12px 32px rgba(0,0,0,0.4)'}}>
            {toast.type === 'error' ? <AlertTriangle size={18} color="#FF453A"/> : <CheckCircle size={18} color="#30D158"/>}
            <span style={{fontSize:14,fontWeight:500}}>{toast.message}</span>
            {toast.undoFn && <button onClick={() => { toast.undoFn(); setToast(null); }} style={{marginLeft:6,fontSize:12,fontWeight:700,color:'var(--accent-2)',background:'rgba(227,200,134,0.15)',border:'1px solid rgba(227,200,134,0.3)',borderRadius:100,padding:'6px 12px',cursor:'pointer'}}>Undo</button>}
          </div>
        </div>
      )}

      {sheet.content && (
        <div className="sheet-wrap">
          <div className={`sheet-scrim${sheet.open && !sheet.closing ? ' open' : ''}`}
            onClick={(e) => e.target === e.currentTarget && closeModal()}/>
          <div
            className={`sheet${sheet.open && !sheet.closing ? ' open' : ''}${sheet.closing ? ' closing' : ''}${sheet.settled && !sheet.closing ? ' settled' : ''}`}
            role="dialog" aria-modal="true" tabIndex={-1} ref={sheetRef} style={{outline:'none'}}
            onTransitionEnd={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.propertyName !== 'transform' && e.propertyName !== 'opacity') return;
              if (sheet.closing) {
                if (sheetTimer.current) { clearTimeout(sheetTimer.current); sheetTimer.current = null; }
                setSheet({ content: null, open: false, closing: false, settled: false });
              } else if (sheet.open && !sheet.settled) {
                setSheet(s => (s.open && !s.closing) ? { ...s, settled: true } : s);  // blur develops after travel
              }
            }}>
            <button className="sheet-grab" onClick={closeModal} aria-label="Close"><i/></button>
            <button onClick={closeModal} aria-label="Close" style={{position:'absolute',top:8,right:14,zIndex:6,background:'rgba(255,255,255,0.08)',border:'none',borderRadius:100,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-dim)',cursor:'pointer'}}><X size={16}/></button>
            <div className="sheet-body">{sheet.content}</div>
          </div>
        </div>
      )}
    </div>
  );
}


function DateButton({ viewDate, setViewDate }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const k = (e) => { if (e.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open]);
  const [calMonth, setCalMonth] = useState(() => new Date(viewDate.getFullYear(), viewDate.getMonth(), 1));
  const today = new Date();
  const sel = viewDate;
  const start = new Date(calMonth);
  const end = new Date(calMonth.getFullYear(), calMonth.getMonth()+1, 0);
  const startDay = start.getDay();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= end.getDate(); d++) cells.push(d);
  const monthName = calMonth.toLocaleDateString(undefined, {month:'long', year:'numeric'});
  const pickDay = (d) => { const nd = new Date(calMonth.getFullYear(), calMonth.getMonth(), d); setViewDate(nd); setOpen(false); };
  return (
    <>
      <button className="hdr-btn" aria-label="Open calendar" aria-haspopup="dialog" aria-expanded={open} onClick={() => { if (!open) setCalMonth(new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)); setOpen(!open); }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>
      </button>
      {open && ReactDOM.createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{position:'fixed',inset:0,zIndex:190}}/>
          <div className="glass-strong anim-slide-up" role="dialog" aria-label="Choose date" style={{position:'fixed',top:'calc(env(safe-area-inset-top, 0px) + 56px)',left:12,zIndex:195,borderRadius:18,padding:14,minWidth:280,boxShadow:'0 20px 50px rgba(0,0,0,0.6)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth()-1, 1))} aria-label="Previous month" style={{background:'rgba(255,255,255,0.06)',border:'none',borderRadius:8,padding:'6px 10px',color:'var(--accent)',cursor:'pointer'}}><ChevronLeft size={14}/></button>
              <div style={{fontSize:13,fontWeight:700}}>{monthName}</div>
              <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth()+1, 1))} aria-label="Next month" style={{background:'rgba(255,255,255,0.06)',border:'none',borderRadius:8,padding:'6px 10px',color:'var(--accent)',cursor:'pointer'}}><ChevronRight size={14}/></button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7, 1fr)',gap:2,marginBottom:6}}>
              {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} style={{textAlign:'center',fontSize:9,color:'var(--text-faint)',fontWeight:700,textTransform:'uppercase'}}>{d}</div>)}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7, 1fr)',gap:2}}>
              {cells.map((d,i) => {
                if (!d) return <div key={i}/>;
                const dt = new Date(calMonth.getFullYear(), calMonth.getMonth(), d);
                const isToday2 = dt.toDateString() === today.toDateString();
                const isSel = dt.toDateString() === sel.toDateString();
                return <button key={i} onClick={() => pickDay(d)} style={{aspectRatio:'1',border:'none',borderRadius:8,background:isSel?'var(--accent)':isToday2?'rgba(227,200,134,0.18)':'transparent',color:isSel?'white':isToday2?'var(--accent-2)':'var(--text)',fontSize:12,fontWeight:isSel||isToday2?700:500,cursor:'pointer'}}>{d}</button>;
              })}
            </div>
            <button onClick={() => { setViewDate(new Date()); setOpen(false); }} style={{marginTop:10,width:'100%',padding:8,borderRadius:10,border:'1px solid var(--border)',background:'rgba(255,255,255,0.04)',color:'var(--text)',fontSize:12,fontWeight:600,cursor:'pointer'}}>Today</button>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function AvatarMenu({ activeProfile, setActiveProfile, protocols, onOpenDataSync, onOpenLibrary, onOpenCalculator, textScale, setTextScale }) {
  const scales = [['1', 'Normal'], ['1.15', 'Larger'], ['1.3', 'Largest']];
  const scaleLabel = (scales.find(s => s[0] === String(textScale)) || scales[0])[1];
  const nextScale = () => { const i = scales.findIndex(s => s[0] === String(textScale)); setTextScale(scales[(i + 1) % scales.length][0]); };
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="avatar" aria-label={'Profile: ' + activeProfile + '. Open profile menu'} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{(activeProfile || '?').charAt(0)}</button>
      {open && ReactDOM.createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{position:'fixed',inset:0,zIndex:190}}/>
          <div className="glass-strong anim-slide-up" role="menu" aria-label="Profiles and data" style={{position:'fixed',top:'calc(env(safe-area-inset-top, 0px) + 56px)',right:12,zIndex:195,width:220,borderRadius:14,padding:6,boxShadow:'0 20px 50px rgba(0,0,0,0.6)'}}>
            {PROFILES.map(p => {
              const count = protocols.filter(x => x.profile === p && x.active !== false).length;
              const isOn = p === activeProfile;
              return (
                <button key={p} role="menuitemradio" aria-checked={isOn} className="menu-row" onClick={() => { setActiveProfile(p); setOpen(false); }}>
                  <span className="avatar sm" aria-hidden="true">{p.charAt(0)}</span>
                  <span style={{flex:1,fontSize:15,fontWeight:isOn?700:500}}>{p}</span>
                  <span className="mono num" style={{fontSize:11,color:'var(--text-dim)'}}>{count}</span>
                  {isOn && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4.5 4.5L19 8"/></svg>}
                </button>
              );
            })}
            <div className="menu-hair"/>
            <button role="menuitem" className="menu-row" onClick={() => { setOpen(false); onOpenLibrary && onOpenLibrary(); }}><span style={{flex:1,fontSize:15}}>Library…</span></button>
            <button role="menuitem" className="menu-row" onClick={() => { setOpen(false); onOpenCalculator && onOpenCalculator(); }}><span style={{flex:1,fontSize:15}}>Reconstitution calculator…</span></button>
            <button role="menuitem" className="menu-row" onClick={nextScale} aria-label={'Text size: ' + scaleLabel + '. Tap to change'}><span style={{flex:1,fontSize:15}}>Text size</span><span className="mono" style={{fontSize:12,color:'var(--accent)'}}>{scaleLabel}</span></button>
            <div className="menu-hair"/>
            <button role="menuitem" className="menu-row" onClick={() => { setOpen(false); onOpenDataSync(); }}>
              <span style={{flex:1,fontSize:15}}>{'Data & sync…'}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function AppHeader({ viewDate, setViewDate, isToday, activeProfile, setActiveProfile, protocols, logged, scheduled, weekDays, syncReady, syncStatus, syncQueued, onSyncTap, onOpenDataSync, onOpenLibrary, onOpenCalculator, textScale, setTextScale }) {
  const [scrolled, setScrolled] = useState(false);
  const sentinelRef = React.useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver((entries) => setScrolled(!entries[0].isIntersecting), { rootMargin: '-48px 0px 0px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const titleLabel = isToday ? 'Today' : viewDate.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
  const eyebrow = (viewDate.toLocaleDateString(undefined, { weekday:'long' }) + ', ' + viewDate.toLocaleDateString(undefined, { month:'short', day:'numeric' })).toUpperCase() + ' · ' + String(activeProfile || '').toUpperCase();
  const frac = scheduled > 0 ? Math.min(1, logged / scheduled) : 0;
  const complete = scheduled > 0 && logged >= scheduled;

  const syncState = !syncReady ? 'setup'
    : (syncStatus === 'pushing' || syncStatus === 'pulling') ? 'syncing'
    : syncStatus === 'error' ? 'error'
    : syncQueued ? 'queued' : 'ok';
  const syncLabel = { setup:'Set up sync', syncing:'↻ syncing…', error:'sync failed — retry', queued:'● queued', ok:'✓ synced' }[syncState];
  const syncAria = { setup:'Cloud sync not configured. Set up sync', syncing:'Cloud sync in progress', error:'Cloud sync failed. Tap to retry', queued:'Changes queued, waiting to sync. Tap to sync now', ok:'Synced to cloud. Tap to refresh' }[syncState];

  return (
    <>
      <header className={scrolled ? 'hdr scrolled' : 'hdr'}>
        <div className="hdr-in">
          <DateButton viewDate={viewDate} setViewDate={setViewDate}/>
          <div className="hdr-center" aria-hidden="true">
            <span className="hdr-mark">PROTOCOL OS</span>
            <span className="hdr-title num">{titleLabel}<span className="mini mono num">{logged}/{scheduled}</span></span>
          </div>
          <button className={'sync-cap num ' + syncState} aria-label={syncAria} onClick={onSyncTap}>{syncLabel}</button>
          <AvatarMenu activeProfile={activeProfile} setActiveProfile={setActiveProfile} protocols={protocols} onOpenDataSync={onOpenDataSync} onOpenLibrary={onOpenLibrary} onOpenCalculator={onOpenCalculator} textScale={textScale} setTextScale={setTextScale}/>
        </div>
      </header>
      <div className="hdr-large">
        <div className="eyebrow num">{eyebrow}</div>
        <div className="title-row">
          <h1 className="large-title">{titleLabel}</h1>
          <div className="ring-wrap" role="img" aria-label={logged + ' of ' + scheduled + ' scheduled doses logged'}>
            <svg viewBox="0 0 48 48" width="40" height="40">
              <circle className="ring-track" cx="24" cy="24" r="20" fill="none" strokeWidth="4.5"/>
              <circle className={complete ? 'ring-arc done' : 'ring-arc'} cx="24" cy="24" r="20" fill="none" strokeWidth="4.5" strokeLinecap="round" strokeDasharray="125.66" transform="rotate(-90 24 24)" style={{strokeDashoffset: 125.66 * (1 - frac), transition:'stroke-dashoffset 600ms cubic-bezier(.65,0,.35,1)'}}/>
            </svg>
            <span className={complete ? 'ring-num num done' : 'ring-num num'}>{logged}/{scheduled}</span>
          </div>
        </div>
        <div className="week">
          {weekDays.map(d => (
            <button key={d.key}
              className={'day' + (d.isSel ? ' sel' : '') + (d.isToday && !d.isSel ? ' today' : '')}
              aria-label={d.aria + (d.isSel ? ', selected' : '')}
              aria-current={d.isSel ? 'date' : undefined}
              onClick={() => setViewDate(new Date(d.y, d.m, d.d))}>
              <span className="dnum num">{d.num}</span>
              <span className="dw" aria-hidden="true">{d.letter}</span>
              <span className={'dot' + (d.allLogged ? ' done' : (d.hasSched ? '' : ' none'))} aria-hidden="true"></span>
            </button>
          ))}
        </div>
      </div>
      <div ref={sentinelRef} style={{height:1}} aria-hidden="true"/>
    </>
  );
}

// First run / empty plan: pick a compound from plain-language groups; dose and days come on the next step.
function FirstRun({ activeProfile, onPick, onLibrary }) {
  const groups = [
    ['TRT & hormones', /anabolic|hormone|testosterone|trt|estrogen|aromatase|thyroid|sexual/i],
    ['Growth hormone & peptides', /\bgh\b|ghrh|secretagogue|igf|growth/i],
    ['Healing & recovery', /heal|repair|recovery|tissue|joint|injur/i],
    ['Sleep & focus', /sleep|cognitive|nootropic|mood|focus|neuro/i],
    ['Weight & metabolic', /glp|weight|metabolic|fat|appetite|insulin/i],
    ['Longevity & other', /./],
  ];
  const used = new Set();
  const lead = ['testosterone', 'testosterone-cypionate', 'testosterone-enanthate', 'hcg', 'anastrozole', 'enclomiphene', 'ipamorelin', 'cjc1295-no-dac', 'tesamorelin', 'bpc157', 'tb500', 'dsip', 'semaglutide', 'tirzepatide', 'retatrutide'];
  const rank = (p) => { const i = lead.indexOf(p.id); return i < 0 ? 99 : i; };
  const buckets = groups.map(([label, re]) => { const items = PEPTIDE_DB.filter(p => !used.has(p.id) && re.test(p.category || '')).sort((a, b) => rank(a) - rank(b)).slice(0, 8); items.forEach(p => used.add(p.id)); return { label, items }; }).filter(b => b.items.length);
  const [open, setOpen] = useState(buckets.length ? buckets[0].label : null);
  const cur = buckets.find(b => b.label === open);
  return (
    <div className="anim-fade-in">
      <div style={{padding:'10px 2px 14px'}}>
        <div className="eyebrow num" style={{marginBottom:6}}>STEP 1 OF 2 · ABOUT A MINUTE</div>
        <h3 style={{margin:0,fontSize:22,fontWeight:800,lineHeight:1.15}}>What is {activeProfile} taking right now?</h3>
        <p style={{margin:'8px 0 0',fontSize:14,lineHeight:1.45,color:'var(--text-dim)'}}>Pick one compound to start. Dose, days and vial come on the next step, and everything can be changed later.</p>
      </div>
      <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:12}}>
        {buckets.map(b => <button key={b.label} onClick={() => setOpen(b.label)} aria-pressed={b.label === open} style={{minHeight:40,padding:'0 13px',borderRadius:100,fontSize:12.5,fontWeight:700,cursor:'pointer',border:'1px solid ' + (b.label === open ? 'rgba(227,200,134,.5)' : 'var(--border)'),background: b.label === open ? 'rgba(227,200,134,.14)' : 'rgba(255,255,255,.04)',color: b.label === open ? 'var(--accent)' : 'var(--text-2)'}}>{b.label}</button>)}
      </div>
      {cur && (
        <section className="blk" aria-label={cur.label}>
          {cur.items.map((p, i) => (
            <div key={p.id} className="blk-row" style={i === 0 ? {borderTop:'none'} : undefined}>
              <button className="blk-main" onClick={() => onPick(p.id)}>
                <span className="blk-disc" aria-hidden="true" style={{fontSize:15,borderColor:'var(--border)',background:'rgba(255,255,255,.05)'}}>{p.icon}</span>
                <span className="blk-text">
                  <span className="blk-name">{p.name}</span>
                  <span className="blk-dose">{(p.protocol && p.protocol.route) || ''}{p.protocol && p.protocol.doseRange ? ' · ' + p.protocol.doseRange : ''}{p.protocol && p.protocol.timing ? ' · ' + p.protocol.timing : ''}</span>
                </span>
                <span className="plan-chev" aria-hidden="true">›</span>
              </button>
            </div>
          ))}
        </section>
      )}
      <button className="btn btn-ghost" style={{width:'100%',marginTop:12}} onClick={onLibrary}>Search the whole library</button>
    </div>
  );
}

function ProtocolView({ mode, openLibrary, openCalculator, viewDate, dateKey, isFuture, activeProfile, protocols, setProtocols, vials, setVials, logs, setLogs, openModal, closeModal, confirmModal, showToast, jumpTo, clearJump }) {
  const [routeFilter, setRouteFilter] = useState('all');
  const [flashId, setFlashId] = useState(null);  // D6 check-off cascade: which card celebrates its fresh log
  const todayDk = todayLocal();
  const baseMine = protocols.filter(p => p.profile === activeProfile);          // BASE records (timeline intact)
  const myProtocols = baseMine.filter(p => p.active !== false);                  // live protocols (empty state, PRN lookups)
  const anyLogOn = (p) => logs.some(l => l.protocolId === p.id && (l.datetime||'').slice(0,10) === dateKey);
  // This day's calendar: every protocol in range on dateKey (or logged on it), resolved to the plan
  // in force THAT day — browsing back shows the old schedule, browsing forward the new one.
  const dayProtos = baseMine.filter(p => anyLogOn(p) || activeOn(p, dateKey)).map(p => protoAt(p, dateKey));
  const isPrn = (p) => isPrnSched(p.schedule);
  const isDue = (p) => dueOn(p, dateKey);
  const dueThisDay = dayProtos.filter(p => isDue(p) && !isPrn(p));
  const shownProtocols = dayProtos.filter(p => isDue(p) || isPrn(p) || anyLogOn(p));

  // today's progress (scheduled, non-PRN)
  const hasLogToday = (p) => logs.some(l => l.protocolId === p.id && (l.datetime||'').slice(0,10) === dateKey && !l.skipped);
  const scheduledCount = dueThisDay.length;
  const loggedCount = dueThisDay.filter(hasLogToday).length;
  const dueCount = scheduledCount - loggedCount;

  // route filter counts (over shown)
  const vialFor = (p) => { const ids = new Set(getEquivalentIds(p.peptideId)); return (vials||[]).find(v => ids.has(v.peptideId) && v.active !== false); };
  const routeForProto = (p) => routeOf(p, vialFor(p));
  const routeCounts = { all: shownProtocols.length, inj:0, oral:0, nasal:0, pen:0 };
  shownProtocols.forEach(p => { routeCounts[routeForProto(p)]++; });
  const filteredProtocols = routeFilter === 'all' ? shownProtocols : shownProtocols.filter(p => routeForProto(p) === routeFilter);

  const blocks = LG_BLOCKS;
  const byBlock = { am:[], pre:[], pm:[], prn:[] };
  filteredProtocols.forEach(p => { const b = blockOf(p); (byBlock[b] || byBlock.am).push(p); });

  // ── C2 cycle lifecycle + D4 one-glow rule ──
  const cycleOverP = (p) => { if (!(p.cycleDays > 0) || isPrn(p) || p.endDate) return false; const s = dkOf(p.startDate); return dkValid(s) && dkDiff(todayDk, s) + 1 > p.cycleDays; };
  const expiredProtos = myProtocols.filter(cycleOverP);
  // ONE glow per screen: first protocol in render order (am→pre→pm) that is due and
  // not logged/skipped/expired/future. Pens render their own branch and never glow.
  const glowId = (() => {
    if (isFuture || dateKey < todayDk) return null; // a past day is not 'due': no glow, no gold plus
    for (const bid of ['am','pre','pm']) {
      for (const p of byBlock[bid]) {
        if (p.route === 'pen') continue;
        if (logs.some(l => l.protocolId === p.id && (l.datetime||'').slice(0,10) === dateKey)) continue;
        if (cycleOverP(p)) continue;
        return p.id;
      }
    }
    return null;
  })();
  // Most recent non-skipped log for this protocol or an equivalent compound (PRN footer).
  const lastPrnLogFor = (p) => { const ids = new Set(getEquivalentIds(p.peptideId)); const pids = new Set(baseMine.filter(x => ids.has(x.peptideId)).map(x => x.id)); let best = null; for (const l of logs) { if (l.skipped || !pids.has(l.protocolId)) continue; if (!best || (l.datetime||'') > (best.datetime||'')) best = l; } return best; };

  // ── Add/Edit-form reconstitution (feeds ReconFields; canonical mg, IU handled by display) ──
  // Modals close over the ProtocolView render that opened them, so all reads here go through
  // vialsRef (always-current) and all writes use FUNCTIONAL updaters — a cloud pull or an
  // in-administer recon save landing while a form is open can neither be clobbered nor duplicated.
  const vialsRef = useRef(vials); vialsRef.current = vials;
  const protocolsRef = useRef(protocols); protocolsRef.current = protocols;
  // A form's recon can only target an INJECTABLE vial record: pens and oral/spray records are
  // excluded so a dual-route compound's pill bottle is never rewritten into an injection vial.
  const injectableVialsFor = (list, peptideId) => {
    const ids = new Set(getEquivalentIds(peptideId));
    return list.filter(v => ids.has(v.peptideId) && v.active !== false && !v.isPen && !['oral', 'spray', 'nasal'].includes(v.formType) && isItemVisibleToProfile(v, activeProfile));
  };
  // Prefill: the compound's existing vial wins (so edits update it in place); otherwise the
  // compound DB's typical vial + diluent as a starting suggestion the user confirms by saving.
  const reconPrefill = (peptideId) => {
    const mine = injectableVialsFor(vialsRef.current, peptideId);
    const v = mine.find(x => (x.mcgPerMl || 0) > 0) || mine[0];
    const reconIsIU = isIUVial(v);
    if (v && v.mgPerVial > 0 && v.diluentMl > 0) return { reconMg: String(v.mgPerVial), reconMl: String(v.diluentMl), reconVialId: v.id, reconIsIU, reconDirty: false };
    const pep = findPep(peptideId);
    const tMg = (pep && pep.reconstitution && pep.reconstitution.typicalVialMg) || 0;
    const tMl = (pep && pep.reconstitution && pep.reconstitution.defaultDiluentMl) || 0;
    return { reconMg: tMg > 0 ? String(tMg) : '', reconMl: tMl > 0 ? String(tMl) : '', reconVialId: v ? v.id : null, reconIsIU, reconDirty: false };
  };
  // Persist the form's reconstitution into the compound's vial record (update in place, else create).
  // Called ONLY inside the gate-approved apply() paths. editMode never writes untouched prefills:
  // a DB-guessed suggestion the user didn't type must not become an authoritative concentration.
  const saveProtoRecon = (f, peptideId, peptideName, doseMcg, cycleDays, editMode) => {
    if ((f.route || 'inj') !== 'inj') return;
    const isIU = f.doseUnit === 'IU' || !!f.reconIsIU;
    const mg = parseFloat(f.reconMg);
    const ml = parseFloat(f.reconMl);
    const bothBlank = !(mg > 0) && !(ml > 0);
    setVials(prev => {
      // Re-resolve the target against CURRENT state: by id first, else by compound (so a stale
      // form can't duplicate a vial another path just created).
      const ex = (f.reconVialId && prev.find(v => v.id === f.reconVialId)) || injectableVialsFor(prev, peptideId).find(x => (x.mcgPerMl || 0) > 0) || injectableVialsFor(prev, peptideId)[0] || null;
      // Deliberate clear (Edit form only): user blanked both fields on a vial that had a draw —
      // drop its concentration so cards fall back to mass and the administer sheet re-prompts recon.
      if (editMode && bothBlank && f.reconDirty && ex && (ex.mcgPerMl || 0) > 0) {
        return prev.map(v => v.id === ex.id ? { ...v, mcgPerMl: 0, mcgPerUnit: 0, unitsPerDose: 0, diluentMl: null } : v);
      }
      if (!(mg > 0) || !(ml > 0) || !(doseMcg > 0)) return prev; // blank/partial = no-op
      if (editMode && !f.reconDirty && !(ex && (ex.mcgPerMl || 0) > 0)) return prev; // edit: untouched DB guess, no real vial — don't invent one
      const totalMcg = mg * 1000;
      const npm = totalMcg / ml;
      const unitsPerDose = doseMcg / (npm / 100);
      if (ex) {
        if (ex.mgPerVial === mg && ex.diluentMl === ml && (ex.doseMcg || 0) === doseMcg && (ex.mcgPerMl || 0) > 0 && (!isIU || ex.unitLabel === 'IU')) return prev; // unchanged (incl. IU flag)
        const patch = { mgPerVial: mg, diluentMl: ml, mcgPerMl: npm, mcgPerUnit: npm / 100, unitsPerDose, totalMcg, remainingMcg: totalMcg, doseMcg, unitLabel: isIU ? 'IU' : (ex.unitLabel || null), iuPerVial: isIU ? Math.round(totalMcg) : (ex.iuPerVial || null), active: true, formType: 'liquid', reconstitutedAt: ex.reconstitutedAt || new Date().toISOString() };
        return prev.map(v => v.id === ex.id ? { ...v, ...patch } : v);
      }
      const pep = findPep(peptideId);
      const nv = { id: 'proto_' + uid(), peptideId, peptideName, mgPerVial: mg, doseMcg, totalMcg, remainingMcg: totalMcg, diluentMl: ml, mcgPerMl: npm, mcgPerUnit: npm / 100, unitsPerDose, unitLabel: isIU ? 'IU' : null, iuPerVial: isIU ? Math.round(totalMcg) : null, reconstitutedAt: new Date().toISOString(), cycleStartDate: todayLocal(), cycleDays: (pep && pep.protocol.cycleDays) || cycleDays || 30, active: true, formType: 'liquid', inventoryProfile: getInventoryProfile(activeProfile) };
      return [nv, ...prev];
    });
  };

  // ── Plan tab + compound page helpers: supply, next dose, adherence, 14-day strip, site rotation ──
  const baseOf = (p) => baseMine.find(b => b.id === p.id) || p;
  const vialOf = (p) => { if (p.route === 'pen') return (vials || []).find(x => x.id === p.penVialId) || null; const ids = new Set(getEquivalentIds(p.peptideId)); const cands = (vials || []).filter(v => ids.has(v.peptideId) && v.active !== false && isItemVisibleToProfile(v, activeProfile)); return cands.find(v => (v.mcgPerMl || 0) > 0) || cands[0] || null; };
  const loggedOn = (p, dk) => logs.some(l => l.protocolId === p.id && (l.datetime || '').slice(0, 10) === dk && !l.skipped);
  const supplyFor = (p0) => {
    const p = baseOf(p0); const v = vialOf(p);
    if (!v || typeof v.remainingMcg !== 'number' || !(p.doseMcg > 0) || !(v.totalMcg > 0)) return null;
    const dosesLeft = Math.max(0, Math.floor(v.remainingMcg / p.doseMcg + 1e-9));
    let runOut = null;
    if (!isPrn(p)) { let n = 0; for (let i = loggedOn(p, todayDk) ? 1 : 0; i <= 400; i++) { const dk = dkAdd(todayDk, i); if (!activeOn(p, dk)) continue; if (dueOn(protoAt(p, dk), dk)) { n++; if (n > dosesLeft) { runOut = dk; break; } } } }
    return { vial: v, dosesLeft, runOut, pct: Math.max(0, Math.min(1, v.remainingMcg / v.totalMcg)) };
  };
  const nextDoseFor = (p0) => { const p = baseOf(p0); if (isPrn(p)) return null; for (let i = 0; i <= 60; i++) { const dk = dkAdd(todayDk, i); if (!activeOn(p, dk)) continue; if (dueOn(protoAt(p, dk), dk)) { if (i === 0 && loggedOn(p, dk)) continue; return dk; } } return null; };
  const adherenceFor = (p0, days) => { const p = baseOf(p0); let exp = 0, got = 0; if (!isPrn(p)) for (let i = 0; i < days; i++) { const dk = dkAdd(todayDk, -i); if (!activeOn(p, dk) || !dueOn(protoAt(p, dk), dk)) continue; exp++; if (loggedOn(p, dk)) got++; } return { exp, got, pct: exp ? Math.round(got / exp * 100) : null }; };
  const dayStatus = (p0, dk) => { const p = baseOf(p0); const ls = logs.filter(l => l.protocolId === p.id && (l.datetime || '').slice(0, 10) === dk); if (ls.some(l => !l.skipped)) return 'logged'; if (ls.length) return 'skipped'; if (isPrn(p) || !activeOn(p, dk) || !dueOn(protoAt(p, dk), dk)) return 'none'; return dk > todayDk ? 'future' : dk === todayDk ? 'due' : 'missed'; };
  const SITES = ['L abdomen', 'R abdomen', 'L thigh', 'R thigh', 'L glute', 'R glute', 'L delt', 'R delt'];
  // Rotation: the site after the one last used for this compound (any equivalent id), so a one-tap log never repeats a site.
  const nextSiteFor = (p) => { const ids = new Set(getEquivalentIds(p.peptideId)); let last = null; for (const l of logs) { if (l.skipped || !l.site || !ids.has(l.peptideId)) continue; if (!last || (l.datetime || '') > (last.datetime || '')) last = l; } return SITES[(SITES.indexOf(last ? last.site : '') + 1) % SITES.length]; };

  // ── Compound page: one place per compound for plan, history, supply and deletion ──
  const openCompound = (base0) => {
    const base = baseOf(base0);
    const p = protoAt(base, todayDk);
    const v = vialOf(base);
    const route = base.route === 'pen' ? 'inj' : routeOf(p, v); const rt = ROUTE_META[route] || ROUTE_META.inj;
    const sup = supplyFor(base); const adh = adherenceFor(base, 30); const next = nextDoseFor(base);
    const startDk = dkOf(base.startDate); const endDk = dkOf(base.endDate); const ended = dkValid(endDk);
    const dayN = (dkValid(startDk) && base.cycleDays > 0 && !isPrn(p)) ? dkDiff(todayDk, startDk) + 1 : null;
    const strip = Array.from({ length: 14 }, (_, i) => { const dk = dkAdd(todayDk, i - 13); return { dk, s: dayStatus(base, dk) }; });
    const tl = timelineSorted(base.timeline || []);
    const title = base.route === 'pen' ? penLabelOf(base) : base.peptideName;
    const Body = () => {
      const [more, setMore] = useState(false);
      return (
        <div>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
            <div style={{width:44,height:44,borderRadius:13,background:rt.color+'24',display:'grid',placeItems:'center',boxShadow:'inset 0 0 0 1px '+rt.color+'40',flexShrink:0}}><RouteIcon route={route} color={rt.color} s={22}/></div>
            <div style={{flex:1,minWidth:0}}>
              <h3 style={{margin:0,fontSize:20,fontWeight:800,lineHeight:1.15,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{title}</h3>
              <div style={{fontSize:13,color:'var(--text-dim)',marginTop:2}}>{base.profile} · {schedLabel(p.schedule)} · <span className="mono" style={{color:'var(--accent)'}}>{fmtDoseAny(p.doseMcg, p.doseUnit)}</span></div>
            </div>
            <button onClick={() => { closeModal(); editProtocol(base); }} aria-label="Edit protocol" className="lg" style={{width:44,height:44,borderRadius:'50%',display:'grid',placeItems:'center',padding:0,cursor:'pointer',flexShrink:0}}><Edit2 size={16} color="var(--text-dim)"/></button>
          </div>
          <div className="cp-stats">
            <div className="cp-stat"><div className="cp-v">{ended ? (endDk < todayDk ? 'Ended' : 'Ends') : dayN ? `Day ${dayN}` : dkValid(startDk) ? fmtDk(startDk) : '—'}</div><div className="cp-k">{ended ? fmtDk(endDk) : dayN ? `of ${base.cycleDays}` : 'since'}</div></div>
            <div className="cp-stat"><div className="cp-v">{adh.pct == null ? '—' : adh.pct + '%'}</div><div className="cp-k">{adh.exp ? `${adh.got}/${adh.exp} doses · 30 d` : 'nothing due yet'}</div></div>
            <div className="cp-stat"><div className="cp-v">{next ? (next === todayDk ? 'Today' : next === dkAdd(todayDk, 1) ? 'Tomorrow' : fmtDk(next)) : isPrn(p) ? 'As needed' : '—'}</div><div className="cp-k">next dose</div></div>
          </div>
          <div className="cp-strip" role="img" aria-label={'Last 14 days: ' + strip.filter(c => c.s === 'logged').length + ' logged, ' + strip.filter(c => c.s === 'missed').length + ' missed'}>{strip.map(c => <span key={c.dk} className={'cp-cell ' + c.s} title={fmtDk(c.dk) + ' · ' + c.s}/>)}</div>
          <PlanCard proto={p} dateKey={todayDk} onChange={() => { closeModal(); editProtocol(base, { applyFrom: todayDk }); }} onFinish={() => finishCycle(p)} onResume={() => resumeCycle(p)}/>
          {tl.length > 1 && <TimelineList timeline={base.timeline}/>}
          {sup ? (
            <div className="lg" style={{borderRadius:14,padding:'12px 14px',marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8}}>
                <div style={{fontSize:13,fontWeight:700}}>Supply · {sup.vial.peptideName}</div>
                <div className="mono" style={{fontSize:12.5,fontWeight:700,color: sup.dosesLeft <= 3 ? 'var(--warn)' : 'var(--text-2)'}}>{sup.dosesLeft} dose{sup.dosesLeft === 1 ? '' : 's'} left</div>
              </div>
              <div style={{height:6,borderRadius:3,background:'rgba(255,255,255,.08)',overflow:'hidden',margin:'8px 0 6px'}}><div style={{width:(sup.pct*100)+'%',height:'100%',background: sup.dosesLeft <= 3 ? 'var(--warn)' : 'var(--success)'}}/></div>
              <div style={{fontSize:11.5,color:'var(--text-dim)'}}>{sup.runOut ? `Runs out around ${fmtDk(sup.runOut)}` : 'Covers the visible plan'}{sup.vial.reconstitutedAt ? ` · opened ${fmtDk(String(sup.vial.reconstitutedAt).slice(0,10))}` : ''}</div>
            </div>
          ) : (route === 'inj' && !isPrn(p) ? <div style={{fontSize:12.5,color:'var(--text-dim)',margin:'0 2px 14px'}}>No supply figure yet. Set the vial's reconstitution in the log sheet to get doses left and a run-out date.</div> : null)}
          <details className="plan-dis" open={more} onToggle={e => setMore(e.target.open)}>
            <summary><span className="plan-dis-t">More</span><span className="plan-dis-s">Delete this compound from the plan</span><span className="plan-dis-c">{more ? 'Hide' : 'Show'}</span></summary>
            <div className="plan-dis-body" style={{paddingBottom:12}}>
              <p style={{margin:'0 0 10px',fontSize:12.5,color:'var(--text-dim)'}}>Deleting removes it from every day of the plan. Logged entries stay in History. To stop it on a date instead, use Finish cycle above.</p>
              <button className="btn btn-danger" style={{width:'100%'}} onClick={() => confirmModal('Delete protocol?', `Delete ${title} from ${activeProfile}'s plan? Logged entries stay in History.`, () => { setProtocols(prev => prev.filter(x => x.id !== base.id)); showToast('Deleted ' + title); }, 'Delete')}>Delete {title}</button>
            </div>
          </details>
        </div>
      );
    };
    openModal(<Body/>);
  };

  // ── Plan tab: the profile's compounds, current and finished ──
  const renderPlan = () => {
    const endOf = (p) => dkOf(p.endDate);
    const finished = baseMine.filter(p => dkValid(endOf(p)) && endOf(p) < todayDk);
    const live = baseMine.filter(p => !finished.includes(p) && (p.active !== false || dkValid(endOf(p))));
    const row = (p) => {
      const v = vialOf(p); const route = p.route === 'pen' ? 'inj' : routeOf(p, v); const rt = ROUTE_META[route] || ROUTE_META.inj;
      const sup = supplyFor(p); const next = nextDoseFor(p); const pd = protoAt(p, todayDk); const e = endOf(p);
      const bits = [schedLabel(pd.schedule, true), fmtDoseAny(pd.doseMcg, pd.doseUnit)];
      if (next) bits.push('next ' + (next === todayDk ? 'today' : next === dkAdd(todayDk, 1) ? 'tomorrow' : fmtDk(next)));
      if (dkValid(e)) bits.push((e < todayDk ? 'ended ' : 'ends ') + fmtDk(e));
      return (
        <div key={p.id} className="blk-row">
          <button className="blk-main" onClick={() => openCompound(p)}>
            <span className="blk-disc" aria-hidden="true" style={{borderColor: rt.color + '66', background: rt.color + '18'}}><RouteIcon route={route} color={rt.color} s={14}/></span>
            <span className="blk-text">
              <span className="blk-name">{p.route === 'pen' ? penLabelOf(p) : p.peptideName}</span>
              <span className="blk-dose mono">{bits.join(' · ')}{sup ? <span className={sup.dosesLeft <= 3 ? 'blk-sub warn' : ''}>{' · ' + sup.dosesLeft + ' left'}</span> : null}</span>
            </span>
            <span className="plan-chev" aria-hidden="true">›</span>
          </button>
        </div>
      );
    };
    return (
      <div style={{paddingBottom:40}} className="anim-fade-in">
        <div style={{display:'flex',gap:8,marginBottom:14}}>
          <button className="btn btn-primary" style={{flex:1}} onClick={() => addProtocol()}>+ Add compound</button>
          <button className="btn btn-ghost" onClick={() => managePen(null)} aria-label="Create a mix (up to 4 compounds)">Mix</button>
          <button className="btn btn-ghost" onClick={openLibrary}>Library</button>
          <button className="btn btn-ghost" onClick={openCalculator} aria-label="Reconstitution calculator">Calc</button>
        </div>
        {live.length === 0 ? <FirstRun activeProfile={activeProfile} onPick={(id) => addProtocol(id)} onLibrary={openLibrary}/> : (
          <section className="blk plan" aria-label="Current plan">
            <div className="blk-hd"><span className="blk-title">Current plan</span><span className="blk-count mono">{live.length}</span></div>
            {live.map(row)}
          </section>
        )}
        {finished.length > 0 && (
          <section className="blk plan" aria-label="Finished" style={{marginTop:14}}>
            <div className="blk-hd"><span className="blk-title" style={{color:'var(--text-dim)'}}>Finished</span><span className="blk-count mono" style={{color:'var(--text-dim)'}}>{finished.length}</span></div>
            {finished.map(row)}
          </section>
        )}
      </div>
    );
  };

  // ── Quick log: one tap on a row's Log pill logs the planned dose when the draw is unambiguous ──
  // (a known syringe concentration or no syringe at all, the last dose equal to the plan, and the dose
  // gate passing). Anything else opens the full sheet, so a one-tap log can never hide a changed draw.
  const vialForQuick = (p) => { const ids = new Set(getEquivalentIds(p.peptideId)); const cands = (vials || []).filter(v => ids.has(v.peptideId) && v.active !== false && isItemVisibleToProfile(v, activeProfile)); return cands.find(v => (v.mcgPerMl || 0) > 0) || cands[0] || null; };
  const lastDoseFor = (p) => { let best = null; for (const l of logs) { if (l.skipped || l.protocolId !== p.id) continue; if (!best || (l.datetime || '') > (best.datetime || '')) best = l; } return best; };
  const slotHourOf = (p) => { const tod = ((p.schedule || {}).timeOfDay || '').toLowerCase(); if (/pre|work/.test(tod)) return 6; if (/bed|night/.test(tod)) return 22; if (/eve|pm/.test(tod)) return 19; if (/noon|mid/.test(tod)) return 12; return 8; };
  // Default timestamp for a dose: the plan's slot on the viewed day, unless that is today and the clock
  // is within 3 h of the slot (then the clock). A morning dose logged at 15:44 reads 8:00 am, not 3:44 pm.
  const defaultDatetime = (p, dk) => {
    const h = slotHourOf(p); const now = new Date(); let dt;
    if (dk === todayLocal() && Math.abs(now.getHours() + now.getMinutes() / 60 - h) <= 3) dt = now;
    else { const t = dkParse(dk); const u = new Date(isNaN(t) ? Date.now() : t); dt = new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), h, 0, 0); }
    const pad = n => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  };
  const quickPlan = (p) => {
    if (isFuture || isPrn(p) || p.route === 'pen') return null;
    const vial = vialForQuick(p);
    const route = routeOf(p, vial);
    const conc = vial && vial.mcgPerMl > 0 ? vial.mcgPerMl : 0;
    if (route === 'inj' && !conc) return null;                                                       // syringe draw unknown → sheet
    const last = lastDoseFor(p);
    if (last && Math.abs((parseFloat(last.doseMcg) || 0) - p.doseMcg) > 1e-6) return null;         // last dose differed from the plan → sheet
    const verdict = runDoseGate(p, p.doseMcg, { isScheduledCheckoff: true, doseUnit: (p.doseUnit && p.doseUnit !== 'mcg') ? p.doseUnit : null }, logs);
    if (verdict.decision !== 'PASS') return null;                                                    // anything the gate wants to say is said in the sheet
    const iu = isIUVial(vial) || p.doseUnit === 'IU';
    const unitTag = (conc && !iu) ? {} : iu ? { doseUnit: 'IU', doseValue: p.doseMcg } : p.doseUnit === 'mg' ? { doseUnit: 'mg', doseValue: p.doseMcg / 1000 } : p.doseUnit === 'g' ? { doseUnit: 'g', doseValue: p.doseMcg / 1e6 } : {};
    return { vial, conc, iu, unitTag, doseMl: conc ? Math.round((p.doseMcg / conc) * 1000) / 1000 : null };
  };
  const quickLabel = (p, plan) => (plan.conc && !plan.iu ? `${Math.round(p.doseMcg / plan.conc * 1000) / 10}u · ` : '') + fmtDoseAny(p.doseMcg, plan.iu ? 'IU' : p.doseUnit);
  const buildQuickLog = (p, plan) => ({ id: uid(), peptide: p.peptideName, peptideId: p.peptideId, vialId: plan.vial ? plan.vial.id : null, protocolId: p.id, profile: p.profile, datetime: defaultDatetime(p, dateKey), doseMcg: p.doseMcg, ...plan.unitTag, doseMl: plan.doseMl, notes: '', site: routeOf(p, plan.vial) === 'inj' ? nextSiteFor(p) : null });
  // One state write for any number of entries, one toast, one Undo that puts the vials back too.
  const commitQuick = (entries) => {
    const byVial = {};
    entries.forEach(e => { if (!e.plan.vial) return; const v = byVial[e.plan.vial.id] || (byVial[e.plan.vial.id] = { mcg: 0, lastDose: e.log.datetime, prevLast: e.plan.vial.lastDose || null }); v.mcg += e.log.doseMcg; if (e.log.datetime > v.lastDose) v.lastDose = e.log.datetime; });
    setLogs(prev => [...entries.map(e => e.log), ...prev]);
    setVials(prev => prev.map(x => byVial[x.id] ? { ...x, lastDose: byVial[x.id].lastDose, ...(typeof x.remainingMcg === 'number' ? { remainingMcg: Math.max(0, x.remainingMcg - byVial[x.id].mcg) } : {}) } : x));
    const ids = new Set(entries.map(e => e.log.id));
    return () => {
      setLogs(prev => prev.filter(l => !ids.has(l.id)));
      setVials(prev => prev.map(x => byVial[x.id] ? { ...x, lastDose: byVial[x.id].prevLast, ...(typeof x.remainingMcg === 'number' ? { remainingMcg: x.remainingMcg + byVial[x.id].mcg } : {}) } : x));
    };
  };
  const quickLog = (p) => {
    const plan = quickPlan(p);
    if (!plan) return administer(p, null);
    const log = buildQuickLog(p, plan);
    setFlashId(p.id); setTimeout(() => setFlashId(null), 1600);
    const undo = commitQuick([{ p, plan, log }]);
    showToast(`✓ ${p.profile} · ${quickLabel(p, plan)} ${p.peptideName}`, 'success', undo);
  };
  const logRemaining = (list) => {
    const ready = list.map(p => ({ p, plan: quickPlan(p) })).filter(e => e.plan);
    if (!ready.length) return;
    const lines = ready.map(e => `${e.p.peptideName} · ${quickLabel(e.p, e.plan)}`).join('; ');
    confirmModal(`Log ${ready.length} doses as planned?`, lines + '. Each one can be opened and changed afterwards; Undo on the toast removes all of them.', () => {
      const entries = ready.map(e => ({ ...e, log: buildQuickLog(e.p, e.plan) }));
      const undo = commitQuick(entries);
      showToast(`✓ Logged ${entries.length} doses`, 'success', undo);
    }, `Log ${ready.length}`);
  };

  const administer = (proto, existingLog = null) => {
    const protoPep = findPep(proto.peptideId);
    const _ids = new Set(getEquivalentIds(proto.peptideId));
    const _matchAll = (proto.route === 'pen' && proto.penVialId)
      ? vials.filter(v => v.id === proto.penVialId)
      : vials.filter(v => _ids.has(v.peptideId) && v.active !== false && isItemVisibleToProfile(v, activeProfile));
    const _ready = _matchAll.filter(v => (v.mcgPerMl || 0) > 0);
    // Prefer a reconstituted vial; otherwise fall back to any matching vial so we can prompt to reconstitute it.
    const myVials = _ready.length ? _ready : _matchAll;
    const vial = myVials[0];
    const mcgPerMl0 = (vial && vial.mcgPerMl) || 0;
    const defaultMl = mcgPerMl0 ? proto.doseMcg / mcgPerMl0 : 0;
    const suggestedSite = nextSiteFor(proto);
    const sup = supplyFor(proto);
    let f0 = existingLog ? { datetime: existingLog.datetime, doseMl: existingLog.doseMl ? String(existingLog.doseMl) : '', doseMcg: existingLog.doseMcg, vialId: existingLog.vialId || (vial ? vial.id : ''), notes: existingLog.notes || '', site: existingLog.site || '' } : { datetime: defaultDatetime(proto, dateKey), doseMl: defaultMl > 0 ? defaultMl.toFixed(3) : '', doseMcg: proto.doseMcg, vialId: vial ? vial.id : '', notes: '', site: suggestedSite };
    const Modal = () => {
      const [f, setF] = useState(f0);
      const [unitsText, setUnitsText] = useState(null); // raw text while typing in the units field (formatting happens on blur, not per keystroke)
      const rm = useReducedMotion();                    // D6 live reduced-motion gate
      const [committing, setCommitting] = useState(false); // D6 plunger-depress commit in flight
      const liveRef = useRef(true);                     // false once GateDialog swaps this Modal out
      useEffect(() => () => { liveRef.current = false; }, []);
      // Local recon patch so an in-modal reconstitution edit reflects immediately
      // (the modal closes over a stale `vials`; we also persist via setVials below).
      const [reconPatch, setReconPatch] = useState(null);
      const baseVial = vials.find(v => v.id === f.vialId) || vial;
      // reconPatch may carry a full freshly-created vial (no baseVial) or a patch onto baseVial.
      const targetVial = (reconPatch && reconPatch.id === (f.vialId || (baseVial && baseVial.id))) ? { ...(baseVial || {}), ...reconPatch } : baseVial;
      const mcgPerMl = (targetVial && targetVial.mcgPerMl) || 0;
      const hasConc = mcgPerMl > 0;
      const adminRoute = routeOf(proto, targetVial);
      // routeOf already resolves explicit proto route > vial formType > compound-DB route, so an
      // explicitly-injectable protocol keeps its reconstitution path even when the compound DB lists
      // an oral option (e.g. Cartalax "Oral or SubQ" used to suppress the recon prompt entirely).
      const isOral = adminRoute !== 'inj'; // "no reconstitution prompt" routes: oral/nasal/pen
      const adminDelivery = deliveryFor(proto, targetVial);
      const isIU = isIUVial(targetVial);
      // Reconstitution IU-awareness: an IU-denominated protocol (proto.doseUnit==='IU') drives an IU vial
      // even before it's flagged, so re-reconstituting HCG etc. captures IU instead of mg. (Kept SEPARATE
      // from the draw-path isIU above, which stays vial-based so a real mcg-concentration vial can't be
      // mislabeled IU.) The saved vial below carries unitLabel:'IU', which then makes isIU true thereafter.
      const reconIsIU = isIU || !!(proto && proto.doseUnit === 'IU');
      // Editable-dose-field unit: explicit protocol unit, else IU vial, else mcg. Display/entry only —
      // the value is always converted back to canonical mcg before setMcg() so syringe math is untouched.
      // If the vial has a real mcg concentration, the syringe draw is mcg-based — force mcg labeling so the
      // unit can't disagree with the math. IU vials -> IU. No concentration (oral / un-reconstituted) -> protocol unit.
      const admUnit = isIU ? 'IU' : (hasConc ? 'mcg' : ((proto && proto.doseUnit) || 'mcg'));
      const admFactor = admUnit === 'g' ? 1e6 : admUnit === 'mg' ? 1000 : 1;
      const admDisp = (f.doseMcg === '' || f.doseMcg == null || isNaN(parseFloat(f.doseMcg))) ? '' : (admFactor === 1 ? f.doseMcg : (parseFloat(f.doseMcg) / admFactor));
      // Display a canonical-mcg value in the protocol's chosen unit (matches the dose-field label). Display only.
      const fmtAdmDose = (mcg) => admUnit === 'IU' ? fmtIU(mcg) : admUnit === 'mcg' ? fmtDoseUnit(mcg, targetVial) : ((mcg||0)/admFactor).toFixed(2).replace(/\.?0+$/,'') + ' ' + admUnit;
      // Reconstitution: ask whenever a non-oral compound has no usable concentration; always editable later.
      const [reconMl, setReconMl] = useState(targetVial && targetVial.diluentMl ? String(targetVial.diluentMl) : '');
      const [reconMg, setReconMg] = useState(targetVial && targetVial.mgPerVial ? String(targetVial.mgPerVial) : '');
      const [editRecon, setEditRecon] = useState(false);
      const drawDragRef = useRef(false);   // D5 The Draw — plunger drag in progress
      const barrelRef = useRef(null);      // D5 The Draw — barrel SVG node
      const needsRecon = !isOral && !hasConc;
      const saveRecon = () => {
        // A blend's vial is defined by its components — if the record is missing/archived, the
        // blend editor must rebuild it; an on-the-fly component-less vial would break the breakdown.
        if ((proto.isBlend || String(proto.peptideId || '').indexOf('blend_') === 0) && !(targetVial && targetVial.id)) return showToast('Rebuild this blend via ✎ Edit protocol', 'error');
        const ml = parseFloat(reconMl);
        const mg = parseFloat(reconMg);
        if (!mg || mg <= 0) return showToast('Enter vial size (mg)', 'error');
        if (!ml || ml <= 0) return showToast('Enter BAC water (mL)', 'error');
        const totalMcg = mg * 1000;
        const npm = totalMcg / ml;
        const refDose = (targetVial && targetVial.doseMcg) || proto.doseMcg || 0;
        const unitsPerDose = npm ? refDose / (npm / 100) : 0;
        if (targetVial && targetVial.id) {
          const patch = { id: targetVial.id, mgPerVial: mg, diluentMl: ml, mcgPerMl: npm, mcgPerUnit: npm / 100, unitsPerDose, totalMcg, remainingMcg: totalMcg, unitLabel: reconIsIU ? 'IU' : ((targetVial && targetVial.unitLabel) || null), iuPerVial: reconIsIU ? Math.round(mg * 1000) : ((targetVial && targetVial.iuPerVial) || null), active: true, reconstitutedAt: targetVial.reconstitutedAt || new Date().toISOString() };
          setReconPatch(patch);
          setVials(vials.map(x => x.id === targetVial.id ? { ...x, ...patch } : x));
        } else {
          // No vial existed for this compound — create a reconstituted one on the fly.
          const nv = { id: 'adm_' + uid(), peptideId: proto.peptideId, peptideName: proto.peptideName, mgPerVial: mg, doseMcg: refDose, totalMcg, remainingMcg: totalMcg, diluentMl: ml, mcgPerMl: npm, mcgPerUnit: npm / 100, unitsPerDose, unitLabel: reconIsIU ? 'IU' : null, iuPerVial: reconIsIU ? Math.round(mg * 1000) : null, reconstitutedAt: new Date().toISOString(), cycleStartDate: todayLocal(), cycleDays: (protoPep && protoPep.protocol.cycleDays) || 30, active: true, formType: 'liquid', inventoryProfile: getInventoryProfile(activeProfile) };
          setVials([nv, ...vials]);
          setReconPatch({ ...nv });
          setF(p => ({ ...p, vialId: nv.id }));
        }
        // Recompute the syringe draw (mL/units) from the current dose now that we know the concentration.
        const nMl = npm ? (parseFloat(f.doseMcg) || refDose) / npm : 0;
        setF(p => ({ ...p, doseMl: nMl > 0 ? nMl.toFixed(3) : '' }));
        setEditRecon(false);
        showToast('Reconstitution saved');
      };
      const setMl = (ml) => { const mcg = mcgPerMl ? (parseFloat(ml)||0) * mcgPerMl : f.doseMcg; setF(p => ({...p, doseMl: ml, doseMcg: Math.round(mcg)})); };
      const setMcg = (mcg) => { const ml = mcgPerMl ? (parseFloat(mcg)||0) / mcgPerMl : 0; setF(p => ({...p, doseMcg: mcg, doseMl: ml > 0 ? ml.toFixed(3) : ''})); };
      const setUnits = (u) => setMl((Math.min(300, Math.max(0, parseFloat(u)||0))/100).toFixed(3)); // 0–300 u: a stray digit can never draw a 5,000-unit syringe
      const onVialChange = (vid) => { const tv = vials.find(v => v.id === vid); const npm = (tv && tv.mcgPerMl) || 0; const nml = npm ? f.doseMcg/npm : 0; setF(p => ({...p, vialId: vid, doseMl: nml > 0 ? nml.toFixed(3) : ''})); };
      const planOnly = isFuture && !existingLog;   // future day: plan tools only, no logging
      const pastDay = dateKey < todayDk;             // past day: say so on the title and the button
      const logVerb = pastDay ? 'Log for ' + fmtDk(dateKey) : 'Log';
      const [planOpen, setPlanOpen] = useState(!!planOnly); // plan tools live behind a disclosure; the dose comes first
      const submit = () => {
        const d = parseFloat(f.doseMcg);
        if (!(d > 0)) return showToast('Enter a dose above zero', 'error');
        const tv = vials.find(v => v.id === f.vialId);
        // Supply: a dose leaves the vial it was drawn from; undo/edit put it back. Reconstitution resets it.
        const adjustSupply = (vialId, deltaMcg) => { if (!vialId || !deltaMcg) return; setVials(prev => prev.map(x => (x.id === vialId && typeof x.remainingMcg === 'number') ? { ...x, remainingMcg: Math.max(0, x.remainingMcg - deltaMcg) } : x)); };
        // IU vials: store doseValue+doseUnit alongside doseMcg (kept populated for sync-compat).
        // Tag the log with the EFFECTIVE administered unit (admUnit already accounts for IU vials and
        // forces mcg when a real concentration vial is present) so the log can't diverge from the display.
        const unitTag = (admUnit && admUnit !== 'mcg') ? { doseUnit: admUnit, doseValue: admFactor === 1 ? d : d / admFactor } : {};
        const commitDose = (needsReview) => {
        // D6: everything logged below is already frozen in this closure (d, f, tv, unitTag) —
        // edits made while the plunger animation runs cannot change what gets committed, and
        // `committing` also drops pointer events on the sheet body for the duration.
        const doCommit = () => {
        const reviewTag = needsReview ? { needsReview: true } : {};
        // Functional updaters + targeted undo: a cloud pull that lands while the sheet is open can
        // neither be clobbered by this write nor wiped by its Undo.
        if (existingLog) {
          const updatedLog = {...existingLog, datetime: f.datetime, doseMcg: d, ...unitTag, ...reviewTag, doseMl: parseFloat(f.doseMl) || null, vialId: f.vialId || null, notes: f.notes, site: adminRoute === 'inj' ? (f.site || null) : null};
          if (d > 0 && updatedLog.skipped) delete updatedLog.skipped; // a skip edited into a real dose is a dose everywhere (tile, ring, History, Claude)
          const prevDoseMcg = existingLog.skipped ? 0 : (parseFloat(existingLog.doseMcg) || 0);
          const sameVial = tv && existingLog.vialId === tv.id;
          setLogs(prev => prev.map(l => l.id === existingLog.id ? updatedLog : l));
          if (reconPatch) setVials(prev => prev.map(x => x.id === reconPatch.id ? { ...x, ...reconPatch } : x));
          if (sameVial) adjustSupply(tv.id, d - prevDoseMcg);
          showToast(`Updated · ${fmtAdmDose(d)} ${proto.peptideName}`, 'success', () => { setLogs(prev => prev.map(l => l.id === existingLog.id ? existingLog : l)); if (sameVial) adjustSupply(tv.id, prevDoseMcg - d); });
        } else {
          // D6 check-off cascade: new-log path only (never edits). Set right before the state
          // mutations so the card celebrates the same render it turns 'logged'.
          if (!rm) { setFlashId(proto.id); setTimeout(() => setFlashId(null), 1600); }
          const log = { id: uid(), peptide: proto.peptideName, peptideId: proto.peptideId, vialId: f.vialId || null, protocolId: proto.id, profile: proto.profile, datetime: f.datetime, doseMcg: d, ...unitTag, ...reviewTag, doseMl: parseFloat(f.doseMl) || null, notes: f.notes, site: adminRoute === 'inj' ? (f.site || null) : null };
          setLogs(prev => [log, ...prev]);
          const prevLastDose = tv ? (tv.lastDose || null) : null;
          if (tv) setVials(prev => prev.map(x => x.id === tv.id ? { ...x, ...(reconPatch && reconPatch.id === x.id ? reconPatch : {}), lastDose: f.datetime, ...(typeof x.remainingMcg === 'number' ? { remainingMcg: Math.max(0, x.remainingMcg - d) } : {}) } : x));
          showToast(`✓ ${proto.profile} · ${fmtAdmDose(d)} ${proto.peptideName}`, 'success', () => { setLogs(prev => prev.filter(l => l.id !== log.id)); if (tv) setVials(prev => prev.map(x => x.id === tv.id ? { ...x, lastDose: prevLastDose, ...(typeof x.remainingMcg === 'number' ? { remainingMcg: x.remainingMcg + d } : {}) } : x)); });
        }
        closeModal();
        };
        // D6 plunger-depress: only when the Draw is actually on screen (this Modal still mounted,
        // concentration known, not mid-recon-edit) and motion is allowed.
        // GateDialog confirms arrive with the Modal unmounted -> instant commit.
        if (liveRef.current && hasConc && !editRecon && !rm) {
          setCommitting(true);              // adds .liq-commit to the liquid + freezes the sheet
          setTimeout(doCommit, 600);        // 560ms depress, then the real commit + closeModal
        } else doCommit();
        };
        // ── dose gate (advisory). PASS commits; CONFIRM/warning echoes implied totals and offers "Log anyway". ──
        const isCheckoff = !existingLog && d === proto.doseMcg;
        const verdict = runDoseGate(proto, d, { isScheduledCheckoff: isCheckoff, doseUnit: (admUnit && admUnit !== 'mcg') ? admUnit : null }, logs);
        if (verdict.decision === 'PASS') return commitDose(false);
        openModal(<GateDialog verdict={verdict}
          onConfirm={verdict.decision === 'CONFIRM' ? (() => commitDose(true)) : null}
          onCancel={closeModal}/>);
      };
      const undoLog = () => {
        if (!existingLog) return;
        setLogs(prev => prev.filter(l => l.id !== existingLog.id));
        showToast(`Undone · ${proto.peptideName}`, 'success', () => setLogs(prev => prev.some(l => l.id === existingLog.id) ? prev : [existingLog, ...prev]));
        closeModal();
      };
      const units = parseFloat(f.doseMl) ? (parseFloat(f.doseMl)*100).toFixed(1) : '';
      const maxU = Math.max(100, Math.ceil((parseFloat(units)||0) * 1.25)); // slider headroom (1mL=100u default)
      // ── D5 The Draw: geometry + ADVISORY guards. UI-only — submit()'s dose gate is untouched and still runs. ──
      const uNow = parseFloat(units) || 0;
      const dNow = parseFloat(f.doseMcg) || 0;
      const stdUnits = (hasConc && proto.doseMcg > 0) ? proto.doseMcg / (mcgPerMl / 100) : null; // standard draw in u
      const drawBasis = Math.max(uNow, stdUnits || 0, 10);
      const barMax = drawBasis <= 27 ? 30 : drawBasis <= 45 ? 50 : drawBasis <= 95 ? 100 : Math.min(300, Math.ceil(drawBasis * 1.15 / 10) * 10); // capped: the scale draws one tick per 2 u
      const devRatio = stdUnits ? uNow / stdUnits : null;
      const deviates = stdUnits != null && uNow > 0 && Math.abs(uNow - stdUnits) / stdUnits > 0.25;
      const uVis = Math.min(uNow, barMax);
      const liqW = Math.max(0, (uVis / barMax) * 248);
      const plX = 3.5 + liqW;
      const snapU = (u) => { setUnitsText(null); setUnits(Math.round((parseFloat(u) || 0) * 2) / 2); };            // 0.5u snap THROUGH setUnits -> stored mcg === displayed
      const stepU = (d) => { setUnitsText(null); setUnits(Math.min(300, Math.max(0, Math.round(((parseFloat(units) || 0) + d) * 10) / 10))); }; // existing stepper math
      const dragUnits = (e) => { const el = barrelRef.current; if (!el) return; const r = el.getBoundingClientRect(); const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); setUnitsText(null); setUnits(frac * barMax); };
      const setQuickTime = (h) => { const dt = new Date(viewDate); if (h == null) { const n = new Date(); dt.setHours(n.getHours(), n.getMinutes(), 0); } else dt.setHours(h,0,0); dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset()); setF({...f, datetime: dt.toISOString().slice(0,16)}); };
      // "In this shot" — for blend vials, how much of EACH component the current draw delivers.
      const vialPep = targetVial ? findPep(targetVial.peptideId) : null;
      const drawMl = parseFloat(f.doseMl) || 0;
      const penComps = (targetVial && targetVial.penComponents && targetVial.penComponents.length) ? expandPenComponents(targetVial.penComponents) : null;
      const penTotal = penComps ? (penComps.reduce((s,c)=>s+(c.mcg||0),0) || 1) : 1;
      const shotBreakdown = (penComps && targetVial.diluentMl > 0)
        ? penComps.map(c => { const sub = findPep(c.peptideId); const compMcgPerMl = (c.mcg||0) / targetVial.diluentMl;
            return { id: c.peptideId || c.name, name: c.name || (sub?sub.name:''), icon: c.icon || (sub?sub.icon:'💊'), pct: Math.round((c.mcg||0)/penTotal*100), mcgInShot: drawMl * compMcgPerMl }; })
        : (vialPep && vialPep.ingredients && targetVial && targetVial.diluentMl > 0)
        ? Object.entries(vialPep.ingredients).sort((a,b)=>b[1]-a[1]).map(([cid, frac]) => {
            const sub = findPep(cid);
            const compMg = (targetVial.mgPerVial || 0) * frac;
            const compMcgPerMl = (compMg * 1000) / targetVial.diluentMl;
            return { id: cid, name: sub ? sub.name : cid, icon: sub ? sub.icon : '💊', pct: Math.round(frac*100), mcgInShot: drawMl * compMcgPerMl };
          })
        : null;
      return (
        <div style={committing ? {pointerEvents:'none'} : undefined}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
            <h3 style={{margin:'0 0 4px',fontSize:22,fontWeight:700}}>{existingLog ? 'Edit Dose' : pastDay ? 'Log for ' + fmtDk(dateKey) : 'Administer'}</h3>
            <button onClick={() => { closeModal(); editProtocol(proto); }} title="Edit protocol" aria-label="Edit protocol" className="lg" style={{width:34,height:34,borderRadius:'50%',display:'grid',placeItems:'center',padding:0,cursor:'pointer',flexShrink:0}}><Edit2 size={15} color="var(--text-dim)"/></button>
          </div>
          <p style={{margin:'0 0 14px',fontSize:14,color:'var(--text-dim)'}}>{proto.peptideName} · <span style={{color:'var(--accent-2)',fontWeight:600}}>{proto.profile}</span></p>
          {planOnly && (
            <div className="lg" style={{borderRadius:14,padding:'12px 14px',marginBottom:14,fontSize:13,color:'var(--text-dim)',lineHeight:1.45}}>
              📅 Scheduled for <b style={{color:'var(--text)'}}>{fmtDk(dateKey)}</b>. Logging opens on the day — use the plan tools below to change the schedule from this date or to finish the cycle here.
            </div>
          )}
          {!planOnly && (<>
          {hasConc && !editRecon ? (
            <>
              {/* D5 THE DRAW — the syringe as the control. Every path (drag/steppers/field) writes
                  through the EXISTING setUnits() -> setMl() chain, so stored doseMcg === displayed. */}
              <div className="card draw">
                <div className="lbl">The Draw</div>
                <div className={`readout${deviates ? ' warned' : ''}`}>
                  <input type="number" step="0.5" inputMode="decimal" className="rv" aria-label="Syringe units"
                    value={unitsText != null ? unitsText : units}
                    onChange={e => { const v = e.target.value; setUnitsText(v); const n = parseFloat(v); if (v !== '' && isFinite(n) && !/[.,]$/.test(v)) setUnits(n); }}
                    onBlur={() => setUnitsText(null)}/>
                  <span className="ru">u</span>
                  <span className="conv">{fmtAdmDose(dNow)} · {(parseFloat(f.doseMl)||0).toFixed(3)} mL</span>
                </div>
                <div className="barrel-row">
                  <button className="card step" aria-label="Decrease by one unit" onClick={() => stepU(-1)}>−</button>
                  <svg ref={barrelRef} className="barrel-svg" viewBox="0 0 255 64" aria-hidden="true"
                    onPointerDown={(e) => { drawDragRef.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {} dragUnits(e); }}
                    onPointerMove={(e) => { if (drawDragRef.current) dragUnits(e); }}
                    onPointerUp={() => { if (!drawDragRef.current) return; drawDragRef.current = false; snapU(units); }}
                    onPointerCancel={() => { if (!drawDragRef.current) return; drawDragRef.current = false; snapU(units); }}>
                    <rect x="2" y="10" width="251" height="26" rx="4" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.35)" strokeWidth="1.3"/>
                    <defs><linearGradient id="d5lq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#e3c886" stopOpacity="0.55"/><stop offset="1" stopColor="#e3c886" stopOpacity="0.26"/>
                    </linearGradient></defs>
                    <rect x="3.5" y="11.5" width={liqW} height="23" fill="url(#d5lq)" className={committing ? 'liq-commit' : undefined} style={{transformBox:'fill-box',transformOrigin:'left center'}}/>
                    <rect x={plX - 1} y="11.5" width="2" height="23" fill="var(--accent)"/>
                    <rect x={plX - 2} y="6" width="7" height="34" rx="2" fill="var(--accent)"/>
                    {(() => { const t = []; for (let u2 = 0; u2 <= barMax; u2 += 2) { const x = 3.5 + (u2 / barMax) * 248; const major = u2 % 10 === 0; t.push(<line key={u2} x1={x} y1="38" x2={x} y2={major ? 48 : 42} stroke={major ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.30)'} strokeWidth="1"/>); } return t; })()}
                    {(() => { const L = []; const st = barMax > 50 ? 20 : 10; for (let u2 = 0; u2 <= barMax; u2 += st) { const x = 3.5 + (u2 / barMax) * 248; L.push(<text key={u2} x={x} y="60" fill="rgba(255,255,255,.51)" fontSize="11" fontFamily="var(--mono)" textAnchor="middle">{u2}</text>); } return L; })()}
                  </svg>
                  <button className="card step" aria-label="Increase by one unit" onClick={() => stepU(1)} style={{color:'var(--accent)'}}>＋</button>
                </div>
                <div className="cap">{isIU ? `${Math.round(mcgPerMl).toLocaleString()} IU/mL` : `${(mcgPerMl/1000).toFixed(2)} mg/mL`} · snaps 0.5u · drag the plunger</div>
                {deviates ? (
                  <div className="dev-row">
                    <span className="t">{devRatio.toFixed(1)}× your standard draw</span>
                    <button onClick={() => snapU(stdUnits)}>Reset to {Math.round(stdUnits * 10) / 10}u</button>
                  </div>
                ) : null}
              </div>
              {/* "In this shot" — per-component breakdown for blends, updates live */}
              {shotBreakdown && shotBreakdown.length > 0 && (
                <div className="lg" style={{borderRadius:16,padding:'11px 12px',margin:'-4px 0 14px'}}>
                  <div style={{fontSize:11,fontWeight:800,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>In this shot</div>
                  <div style={{display:'flex',flexDirection:'column',gap:7}}>
                    {shotBreakdown.map(c => (
                      <div key={c.id} style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:15}}>{c.icon}</span>
                        <span style={{flex:1,fontSize:12,color:'var(--text-2)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.name} <span style={{color:'var(--text-faint)'}}>· {c.pct}%</span></span>
                        <span style={{fontSize:13,fontWeight:800,fontFamily:'var(--mono)',color:'var(--accent)'}}>{fmtMcg(c.mcgInShot)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : !editRecon ? (
            <>
              {(() => { const live = deliveryFor({ ...proto, doseMcg: parseFloat(f.doseMcg)||proto.doseMcg }, targetVial); if ((adminRoute==='oral'||adminRoute==='nasal') && live.n!=null) return (
                <div className="lg" style={{borderRadius:16,padding:'14px 16px',marginBottom:12,display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:44,height:44,borderRadius:13,background:ROUTE_META[adminRoute].color+'24',display:'grid',placeItems:'center',boxShadow:'inset 0 0 0 1px '+ROUTE_META[adminRoute].color+'40',flexShrink:0}}><RouteIcon route={adminRoute} color={ROUTE_META[adminRoute].color} s={22}/></div>
                  <div>
                    <div style={{fontSize:18,fontWeight:700,color:'var(--text)'}}>{adminRoute==='oral'?'Take':'Use'} {live.chip}</div>
                    <div style={{fontSize:12,color:'var(--text-dim)',marginTop:2}}>{fmtAdmDose(parseFloat(f.doseMcg)||proto.doseMcg)}{adminRoute==='oral'?' · with water':' · 1 spray per nostril'}</div>
                  </div>
                </div>
              ); return null; })()}
              <Field label={`Dose (${admUnit})`}><input type="number" min="0" inputMode="decimal" value={admDisp} onChange={e => { if (parseFloat(e.target.value) < 0) return; setMcg(admFactor===1 ? e.target.value : Math.round((parseFloat(e.target.value)||0)*admFactor)); }} className="input"/></Field>
            </>
          ) : null}
          <Field label="Date & Time">
            <input type="datetime-local" aria-label="Date and time" value={f.datetime} onChange={e => setF({...f, datetime: e.target.value})} className="input"/>
            <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
              {[['Now',null],['Morning',8],['Pre-WO',6],['Noon',12],['Evening',19],['Bedtime',22]].map(([l,h]) => <button key={l} onClick={() => setQuickTime(h)} style={{background:'rgba(255,255,255,0.06)',border:'1px solid var(--border)',borderRadius:100,padding:'6px 14px',minHeight:44,fontSize:12,color:'var(--text-dim)',cursor:'pointer',fontWeight:600}}>{l}</button>)}
            </div>
          </Field>
          {adminRoute === 'inj' && (
            <Field label="Injection site">
              <div style={{display:'grid',gridTemplateColumns:'repeat(4, minmax(0,1fr))',gap:6}}>
                {SITES.map(s => <button key={s} type="button" aria-pressed={f.site === s} onClick={() => setF(p => ({ ...p, site: p.site === s ? '' : s }))} style={{minHeight:40,padding:'0 4px',borderRadius:11,fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',border:'1px solid ' + (f.site === s ? 'rgba(227,200,134,.5)' : 'var(--border)'),background: f.site === s ? 'rgba(227,200,134,.14)' : 'rgba(255,255,255,.04)',color: f.site === s ? 'var(--accent)' : 'var(--text-2)'}}>{s}</button>)}
              </div>
              {!existingLog && suggestedSite && <div style={{fontSize:11.5,color:'var(--text-faint)',marginTop:6}}>Next in rotation: {suggestedSite}</div>}
            </Field>
          )}
          <Field label="Note">
            <input type="text" aria-label="Note for this dose" placeholder="Optional — new vial, slight sting, …" value={f.notes || ''} onChange={e => setF({...f, notes: e.target.value})} className="input"/>
          </Field>
          {myVials.length > 1 && <Field label="Source Vial"><select value={f.vialId} onChange={e => onVialChange(e.target.value)} className="input">{myVials.map(v => <option key={v.id} value={v.id}>{v.peptideName}{(v.mcgPerMl||0) > 0 ? ` · ${isIUVial(v) ? Math.round(v.mcgPerMl).toLocaleString()+' IU/mL' : (v.mcgPerMl/1000).toFixed(2)+' mg/mL'}` : ' · not reconstituted'}</option>)}</select></Field>}
          {myVials.length === 1 && targetVial && <div style={{marginBottom:16,fontSize:13,color:'var(--text-dim)',background:'var(--bg-card-2)',padding:12,borderRadius:12,border:'1px solid var(--border)'}}><b style={{color:'var(--text)'}}>{targetVial.peptideName}</b> · {hasConc ? (isIUVial(targetVial) ? `${Math.round(targetVial.mgPerVial*1000).toLocaleString()} IU vial` : `${targetVial.mgPerVial} mg vial`) : (targetVial.mgPerVial ? `${targetVial.mgPerVial} mg · not reconstituted` : 'not reconstituted')}</div>}
          {sup && !isOral && !editRecon && <div style={{fontSize:12,margin:'-6px 2px 10px',color: sup.dosesLeft <= 3 ? 'var(--warn)' : 'var(--text-dim)'}} className="mono">{sup.dosesLeft} dose{sup.dosesLeft === 1 ? '' : 's'} left in this vial{sup.runOut ? ` · runs out around ${fmtDk(sup.runOut)}` : ''}</div>}
          {targetVial && !isOral && mcgPerMl > 0 && !editRecon && <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,fontSize:11,color:'var(--text-dim)',margin:'-2px 2px 12px'}}><span style={{fontFamily:'SF Mono, monospace'}}>{isIU ? (mcgPerMl/100).toFixed(1) + ' IU' : fmtMcg(mcgPerMl/100)}/unit · {targetVial.diluentMl} mL {isOilPep(proto.peptideId) ? 'vial' : 'BAC'}</span><button onClick={() => { setReconMl(targetVial.diluentMl ? String(targetVial.diluentMl) : ''); setEditRecon(true); }} style={{flexShrink:0,background:'var(--bg-card-2)',border:'1px solid var(--border)',borderRadius:20,padding:'5px 11px',fontSize:11,color:'var(--accent-2)',cursor:'pointer',fontWeight:700}}>Edit reconstitution</button></div>}
          {!isOral && needsRecon && (proto.isBlend || String(proto.peptideId || '').indexOf('blend_') === 0) && !targetVial && (
            <div style={{background:'rgba(255,159,10,0.07)',border:'1px solid rgba(255,159,10,0.25)',padding:14,borderRadius:14,marginBottom:16}}>
              <div style={{fontSize:12,color:'var(--text-2)',marginBottom:10}}>This blend's vial record is missing — rebuild it in the blend editor so the per-component breakdown stays correct.</div>
              <button className="btn btn-ghost" style={{width:'100%'}} onClick={() => { closeModal(); editProtocol(proto); }}>Edit blend</button>
            </div>
          )}
          {!isOral && (needsRecon || editRecon) && !((proto.isBlend || String(proto.peptideId || '').indexOf('blend_') === 0) && !targetVial) && (
            <div style={{background:'rgba(255,159,10,0.07)',border:'1px solid rgba(255,159,10,0.25)',padding:14,borderRadius:14,marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:800,color:'var(--warn)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>{isOilPep(proto.peptideId) ? (needsRecon ? 'Set vial concentration' : 'Edit vial concentration') : (needsRecon ? 'Set reconstitution' : 'Edit reconstitution')}</div>
              <div style={{fontSize:12,color:'var(--text-dim)',marginBottom:10}}>{isOilPep(proto.peptideId) ? 'Pre-mixed oil — enter the total mg and the vial volume (e.g. 2000 mg in 10 mL) to dose by syringe units.' : `Enter vial size and BAC water to dose this ${isIU ? 'in IU' : 'by syringe units'}.`} {needsRecon && <span style={{color:'var(--text-faint)'}}>(or just log a dose above)</span>}</div>
              {(SOLVENT_OVERRIDE[proto.peptideId] || (targetVial && (targetVial.penComponents || []).some(c => SOLVENT_OVERRIDE[c.peptideId]))) && <div style={{fontSize:11.5,color:'var(--rt-oral, #f78c3a)',background:'rgba(247,140,58,0.10)',border:'1px solid rgba(247,140,58,0.25)',borderRadius:10,padding:'8px 10px',marginBottom:10}}>💡 Preferred solvent for {proto.peptideName}: <b>{SOLVENT_OVERRIDE[proto.peptideId] || solventFor(null, targetVial.penComponents)}</b> (not plain BAC)</div>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                {/* Blend vials: the total is the sum of the components — locked here (edit the blend itself via ✎ Edit protocol) so the concentration can never drift from what's actually in the vial. */}
                {(targetVial && targetVial.penComponents && targetVial.penComponents.length)
                  ? <div><label style={{fontSize:11,color:'var(--text-faint)',textTransform:'uppercase',fontWeight:700,letterSpacing:'0.04em'}}>Vial size (mg · blend)</label><div className="input" style={{textAlign:'center',fontFamily:'SF Mono, monospace',fontWeight:700,background:'rgba(255,255,255,0.04)',color:'var(--text-dim)'}}>{reconMg || '—'}</div></div>
                  : <div><label style={{fontSize:11,color:'var(--text-faint)',textTransform:'uppercase',fontWeight:700,letterSpacing:'0.04em'}}>{reconIsIU ? 'Vial (IU)' : 'Vial size (mg)'}</label><input type="number" aria-label={reconIsIU ? 'Vial size in IU' : 'Vial size in mg'} step={reconIsIU ? '1' : '0.1'} value={reconIsIU ? (reconMg !== '' ? Math.round(parseFloat(reconMg)*1000) : '') : reconMg} onChange={e => setReconMg(reconIsIU ? String((parseFloat(e.target.value)||0)/1000) : e.target.value)} className="input" style={{textAlign:'center',fontFamily:'SF Mono, monospace',fontWeight:700}}/></div>}
                <div><label style={{fontSize:11,color:'var(--text-faint)',textTransform:'uppercase',fontWeight:700,letterSpacing:'0.04em'}}>{isOilPep(proto.peptideId) ? 'Vial volume (mL)' : 'BAC water (mL)'}</label><input type="number" aria-label={isOilPep(proto.peptideId) ? 'Vial volume in mL' : 'BAC water in mL'} step="0.1" value={reconMl} onChange={e => setReconMl(e.target.value)} className="input" style={{textAlign:'center',fontFamily:'SF Mono, monospace',fontWeight:700}}/></div>
              </div>
              <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                {editRecon && <button className="btn btn-ghost" onClick={() => setEditRecon(false)}>Cancel</button>}
                <button className="btn btn-primary" onClick={saveRecon}>Save reconstitution</button>
              </div>
            </div>
          )}
          
          </>)}
          <details className="plan-dis" open={planOpen} onToggle={e => setPlanOpen(e.target.open)}>
            <summary><span className="plan-dis-t">Plan</span><span className="plan-dis-s">{schedLabel(proto.schedule, true)} · {fmtAdmDose(proto.doseMcg)}{dkValid(dkOf(proto.endDate)) ? ' · ends ' + fmtDk(dkOf(proto.endDate)) : ''}</span><span className="plan-dis-c">{planOpen ? 'Hide' : 'Change · Finish'}</span></summary>
            <div className="plan-dis-body">
              <PlanCard proto={proto} dateKey={dateKey}
                onChange={() => { closeModal(); editProtocol(proto, { applyFrom: dateKey }); }}
                onFinish={() => finishCycle(proto)} onResume={() => resumeCycle(proto)}/>
            </div>
          </details>
          {/* D5 confirm bar — the label restates the commitment; onClick={submit} is the gate-wired path. */}
          {planOnly ? (
            <div className="sheet-foot">
              <button className="btn btn-ghost" style={{flex:1,minHeight:48,borderRadius:14}} onClick={closeModal}>Close</button>
            </div>
          ) : (
          <div className="sheet-foot">
            {existingLog
              ? <button className="btn btn-danger" style={{minHeight:48,padding:'0 18px',borderRadius:14}} onClick={undoLog}>Undo</button>
              : isPrn(proto)
                ? <button className="btn btn-ghost" style={{minHeight:48,padding:'0 18px',borderRadius:14}} onClick={closeModal}>Cancel</button>
                : <button className="btn btn-ghost" style={{minHeight:48,padding:'0 18px',borderRadius:14}} onClick={() => { closeModal(); skipDose(proto); }}>Skip</button>}
            <button className="btn btn-primary" onClick={submit} disabled={editRecon} style={{flex:1,minHeight:52,fontSize:16,borderRadius:14}}>
              {existingLog ? <>Save · <span className="mono">{hasConc && !isOral ? `${units}u` : fmtAdmDose(dNow)}</span></>
                : hasConc && !isOral ? <>{logVerb} <span className="mono">{units}u</span> · <span className="mono">{fmtAdmDose(dNow)}</span></>
                : <>{logVerb} <span className="mono">{fmtAdmDose(dNow)}</span></>}
            </button>
          </div>
          )}
        </div>
      );
    };
    openModal(<Modal/>);
  };

  // ── Cycle lifecycle from the tile sheet ──
  // Finish: the compound stops appearing after the VIEWED day (today, a past day or a future day);
  // every logged entry stays. Resume clears the end date.
  const finishCycle = (proto) => {
    const when = dateKey;
    const label = when === todayDk ? 'today' : 'on ' + fmtDk(when);
    confirmModal('Finish cycle?', `${proto.peptideName} comes off the schedule after ${label}. Everything already logged stays in History.`, () => {
      const prev = protocolsRef.current;
      setProtocols(ps => ps.map(x => x.id === proto.id ? finishProto(x, when, todayDk) : x));
      showToast(`Finished ${proto.peptideName}`, 'success', () => setProtocols(prev));
    }, 'Finish cycle');
  };
  const resumeCycle = (proto) => {
    setProtocols(ps => ps.map(x => x.id === proto.id ? resumeProto(x, todayDk) : x));
    showToast(`${proto.peptideName} back on the schedule`);
    closeModal();
  };
  // History → Protocol hand-off: open the tile (in edit mode when a log id is given) once we're on its day.
  useEffect(() => {
    if (!jumpTo || jumpTo.dateKey !== dateKey) return;
    const base = protocols.find(p => p.id === jumpTo.protocolId);
    const log = jumpTo.logId ? logs.find(l => l.id === jumpTo.logId) : null;
    clearJump && clearJump();
    if (base) setTimeout(() => administer(protoAt(base, dateKey), log || null), 60);
    // eslint-disable-next-line
  }, [jumpTo, dateKey]);

  const skipDose = (proto) => {
    const log = { id: uid(), peptide: proto.peptideName, peptideId: proto.peptideId, vialId: null, protocolId: proto.id, profile: proto.profile, datetime: dateKey + 'T08:00', doseMcg: 0, skipped: true };
    setLogs(prev => [log, ...prev]);
    showToast(`Skipped ${proto.peptideName}`, 'success', () => setLogs(prev => prev.filter(l => l.id !== log.id)));
  };

  const managePen = (existing = null) => {
    const exVial = existing ? vials.find(v => v.id === existing.penVialId) : null;
    const f0 = existing ? {
      color: existing.penColor || 'blue', name: existing.penName || '',
      comps: (exVial && exVial.penComponents && exVial.penComponents.length) ? exVial.penComponents.map(c => ({ peptideId: c.peptideId || '', mcg: String(c.mcg) })) : [{ peptideId:'', mcg:'' }],
      units: String((exVial && exVial.unitsPerDose) || 30),
      sched: normSched(existing.schedule, existing.startDate),
    } : { color: 'blue', name: '', comps: [{ peptideId:'', mcg:'' }], units: '30', sched: { days: ALL_DAYS.slice(), timeOfDay: 'morning' } };
    const Modal = () => {
      const [f, setF] = useState(f0);
      const setComp = (i, patch) => setF(p => ({ ...p, comps: p.comps.map((c,j) => j===i ? {...c, ...patch} : c) }));
      const addComp = () => setF(p => p.comps.length < 4 ? { ...p, comps: [...p.comps, { peptideId:'', mcg:'' }] } : p);
      const rmComp = (i) => setF(p => ({ ...p, comps: p.comps.length>1 ? p.comps.filter((_,j)=>j!==i) : p.comps }));
      const total = f.comps.reduce((s,c)=> s + (parseFloat(c.mcg)||0), 0);
      const mpm = total / PEN_VOL_ML; const std = parseFloat(f.units)||0; const drawMl = std/100;
      const pm = PEN_META[f.color] || PEN_META.blue;
      const solventNote = solventFor(null, f.comps.map(c=>({peptideId:c.peptideId})));
      const onSave = () => {
        const comps = f.comps.filter(c => c.peptideId && (parseFloat(c.mcg)||0) > 0).map(c => { const p = findPep(c.peptideId); return { peptideId: c.peptideId, name: p ? p.name : c.peptideId, icon: p ? p.icon : '💊', mcg: parseFloat(c.mcg)||0 }; });
        if (!comps.length) return showToast('Add at least one compound', 'error');
        const tMcg = comps.reduce((s,c)=>s+c.mcg,0); const mm = tMcg/PEN_VOL_ML; const s = parseFloat(f.units)||0; const dMcg = (mm/100)*s;
        const vialId = (exVial && exVial.id) || ('pen_'+uid());
        const penName = (f.name || '').trim() || null;
        const label = penName || pm.label;
        const penVial = { id: vialId, isPen:true, pen:f.color, penColor:f.color, penName, penComponents:comps, peptideId:'__pen__', peptideName: label, diluentMl:PEN_VOL_ML, mgPerVial:tMcg/1000, totalMcg:tMcg, remainingMcg: (exVial && exVial.remainingMcg != null && exVial.totalMcg === tMcg) ? exVial.remainingMcg : tMcg, mcgPerMl:mm, mcgPerUnit:mm/100, unitsPerDose:s, doseMcg:dMcg, reconstitutedAt: (exVial && exVial.reconstitutedAt) || new Date().toISOString(), cycleStartDate: todayLocal(), cycleDays:30, active:true, formType:'liquid', inventoryProfile: getInventoryProfile(activeProfile) };
        setVials(exVial ? vials.map(v => v.id===vialId ? penVial : v) : [penVial, ...vials]);
        const protoName = label + ' — ' + expandPenComponents(comps).map(c => (c.name||'').split(' ')[0]).join(' + ');
        const penSched = normSched(f.sched, existing ? existing.startDate : dateKey);
        if (existing) setProtocols(prev => prev.map(p => p.id===existing.id ? materializeProto({...p, peptideName:protoName, route:'pen', penColor:f.color, penName, penVialId:vialId, doseMcg:dMcg, doseUnit:null, doseValue:null, schedule:penSched, timeline: undefined}, todayDk) : p));
        else setProtocols(prev => [materializeProto({ id:uid(), profile:activeProfile, peptideId:'__pen__', peptideName:protoName, route:'pen', penColor:f.color, penName, penVialId:vialId, doseMcg:dMcg, doseUnit:null, doseValue:null, schedule:penSched, cycleDays:30, startDate:dateKey, active:true, createdAt:new Date().toISOString() }, todayDk), ...prev]);
        showToast(existing ? 'Mix updated' : 'Mix created'); closeModal();
      };
      const onRemove = () => confirmModal('Delete mix?', `Remove ${pm.label} and its blend?`, () => { setProtocols(protocols.filter(p => p.id !== existing.id)); setVials(vials.filter(v => v.id !== existing.penVialId)); showToast('Mix deleted'); }, 'Delete');
      const dl = ['S','M','T','W','T','F','S'];
      return (
        <div>
          <h3 style={{margin:'0 0 4px',fontSize:22,fontWeight:700}}>{existing ? 'Edit Mix' : 'Create Mix'}</h3>
          <p style={{margin:'0 0 16px',fontSize:13,color:'var(--text-dim)'}}>Mix up to 4 compounds in a {PEN_VOL_ML} mL pen · dosed in syringe units</p>
          <Field label="Pen colour">
            <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:7}}>
              {PEN_ORDER.map(k => { const on=f.color===k; const m=PEN_META[k]; return <button key={k} onClick={()=>setF({...f,color:k})} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'9px 2px',borderRadius:12,border:'1px solid '+(on?m.color:'var(--border)'),background:on?m.color+'22':'rgba(255,255,255,.04)',cursor:'pointer'}}><span style={{width:16,height:16,borderRadius:'50%',background:m.color,boxShadow:on?'0 0 8px '+m.color:''}}/><span style={{fontSize:11,fontWeight:700,color:on?m.color:'var(--text-dim)'}}>{m.label.split(' ')[0]}</span></button>; })}
            </div>
            <input value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder={`Custom pen name (optional, e.g. "${PEN_META[f.color].label.split(' ')[0]} #2")`} className="input" style={{marginTop:8,fontSize:13}}/>
          </Field>
          <Field label="Compounds (total mcg in pen)">
            {f.comps.map((c,i) => (
              <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 90px auto',gap:6,marginBottom:6,alignItems:'center'}}>
                <select value={c.peptideId} onChange={e=>setComp(i,{peptideId:e.target.value})} className="input" style={{padding:'10px'}}><option value="">Compound…</option>{CATEGORIES.map(cat => <optgroup key={cat} label={cat}>{PEPTIDE_DB.filter(p=>p.category===cat).map(p=><option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}</optgroup>)}</select>
                <input type="number" placeholder="mcg" value={c.mcg} onChange={e=>setComp(i,{mcg:e.target.value})} className="input" style={{padding:'10px',textAlign:'center',fontFamily:'var(--mono)'}}/>
                <button onClick={()=>rmComp(i)} disabled={f.comps.length<=1} aria-label="Remove compound" style={{width:34,height:34,borderRadius:9,border:'1px solid var(--border)',background:'var(--bg-card-2)',color:'var(--danger)',cursor:f.comps.length<=1?'default':'pointer',opacity:f.comps.length<=1?0.3:1}}>✕</button>
              </div>
            ))}
            {f.comps.length < 4 && <button onClick={addComp} style={{fontSize:12,fontWeight:700,color:'var(--accent)',background:'var(--bg-card-2)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 12px',cursor:'pointer',marginTop:2}}>+ Add compound</button>}
          </Field>
          {SOLVENT_OVERRIDE && f.comps.some(c=>SOLVENT_OVERRIDE[c.peptideId]) && <div style={{fontSize:11.5,color:'var(--amber)',background:'rgba(247,140,58,0.10)',border:'1px solid rgba(247,140,58,0.25)',borderRadius:10,padding:'8px 10px',marginBottom:10}}>💡 Preferred solvent: <b>{solventNote}</b></div>}
          <Field label="Standard dose (units on pen)"><input type="number" value={f.units} onChange={e=>setF({...f,units:e.target.value})} className="input" style={{textAlign:'center',fontFamily:'var(--mono)',fontWeight:700}}/></Field>
          {total > 0 && std > 0 && (
            <div className="lg" style={{borderRadius:14,padding:'11px 12px',marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:800,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>At {std} units</div>
              {expandPenComponents(f.comps.filter(c=>c.peptideId && parseFloat(c.mcg)>0).map(c=>({peptideId:c.peptideId, mcg:parseFloat(c.mcg)||0}))).map((c,i)=>{ const mcgInShot = drawMl * ((c.mcg||0)/PEN_VOL_ML); return <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><span style={{fontSize:14}}>{c.icon}</span><span style={{flex:1,fontSize:12,color:'var(--text-2)'}}>{c.name}</span><span style={{fontSize:13,fontWeight:800,fontFamily:'var(--mono)',color:pm.color}}>{fmtMcg(mcgInShot)}</span></div>; })}
            </div>
          )}
          <Field label="Schedule">
            <SchedulePicker value={f.sched} onChange={s => setF(p => ({ ...p, sched: s }))} anchorDefault={existing ? existing.startDate : dateKey} previewFrom={dateKey}/>
          </Field>
          <Field label="Time of Day"><TimeOfDaySelect value={f.sched.timeOfDay} onChange={v => setF(p => ({ ...p, sched: { ...p.sched, timeOfDay: v } }))}/></Field>
          <div style={{display:'grid',gridTemplateColumns: existing ? '1fr 1.4fr' : '1fr',gap:10,marginTop:6}}>
            {existing && <button className="btn btn-danger" onClick={onRemove}>Delete</button>}
            <button className="btn btn-primary" onClick={onSave}>{existing ? 'Save Mix' : 'Create Mix'}</button>
          </div>
        </div>
      );
    };
    openModal(<Modal/>);
  };

  // ── Custom blend vial: up to 4 compounds mixed in ONE vial (the pen builder's sibling, but a
  // real vial — mg per compound + BAC water — dosed in mcg/mg of total blend). Each blend gets a
  // UNIQUE peptideId shared by its protocol + vial, so vial lookups, the dose gate, and recon
  // editing all stay per-blend and two different blends can never cross-match.
  const manageBlend = (existing = null) => {
    const exVial = existing ? (vialsRef.current.find(v => v.id === existing.blendVialId) || injectableVialsFor(vialsRef.current, existing.peptideId)[0] || null) : null;
    const f0 = existing ? {
      name: existing.peptideName || '',
      comps: (exVial && exVial.penComponents && exVial.penComponents.length) ? exVial.penComponents.map(c => ({ peptideId: c.peptideId || '', mg: String((c.mcg || 0) / 1000) })) : [{ peptideId: '', mg: '' }],
      doseStr: String(existing.doseUnit === 'mg' ? (existing.doseMcg || 0) / 1000 : (existing.doseMcg || 0)), doseUnit: existing.doseUnit === 'mg' ? 'mg' : 'mcg',
      reconMl: exVial && exVial.diluentMl ? String(exVial.diluentMl) : '',
      sched: normSched(existing.schedule, existing.startDate),
      cycleDays: existing.cycleDays || 30, startDate: existing.startDate || todayLocal(),
    } : { name: '', comps: [{ peptideId: '', mg: '' }], doseStr: '', doseUnit: 'mcg', reconMl: '', sched: { days: ALL_DAYS.slice(), timeOfDay: 'morning' }, cycleDays: 30, startDate: dateKey };
    const Modal = () => {
      const [f, setF] = useState(f0);
      const setComp = (i, patch) => setF(p => ({ ...p, comps: p.comps.map((c, j) => j === i ? { ...c, ...patch } : c) }));
      const addComp = () => setF(p => p.comps.length < 4 ? { ...p, comps: [...p.comps, { peptideId: '', mg: '' }] } : p);
      const rmComp = (i) => setF(p => ({ ...p, comps: p.comps.length > 1 ? p.comps.filter((_, j) => j !== i) : p.comps }));
      const goodComps = f.comps.filter(c => c.peptideId && (parseFloat(c.mg) || 0) > 0);
      const totalMg = goodComps.reduce((s, c) => s + (parseFloat(c.mg) || 0), 0);
      const ml = parseFloat(f.reconMl) || 0;
      const duF = f.doseUnit === 'mg' ? 1000 : 1;
      // f.doseStr holds the RAW typed string in the display unit (so decimals like "2.5 mg" type
      // cleanly); canonical mcg is derived here, and the unit toggle converts the string in place.
      const dose = Math.round((parseFloat(f.doseStr) || 0) * duF); // canonical mcg of total blend
      const m = (totalMg > 0 && ml > 0) ? vialMath(totalMg, ml, dose) : null;
      const overVial = m && dose > 0 && m.totalDoses < 1;
      const overBarrel = m && dose > 0 && m.unitsPerDose > 100;
      const solventNote = solventFor(null, goodComps.map(c => ({ peptideId: c.peptideId })));
      const onSave = () => {
        // A row with a compound but no mg (or mg but no compound) must not be silently dropped —
        // the saved concentration would understate what is physically in the vial.
        if (f.comps.some(c => (!!c.peptideId) !== ((parseFloat(c.mg) || 0) > 0))) return showToast('Finish or remove the incomplete compound row', 'error');
        if (!goodComps.length) return showToast('Add at least one compound', 'error');
        if (!(dose > 0)) return showToast('Set dose', 'error');
        const comps2 = goodComps.map(c => { const p = findPep(c.peptideId); return { peptideId: c.peptideId, name: p ? p.name : c.peptideId, icon: p ? p.icon : '💊', mcg: Math.round((parseFloat(c.mg) || 0) * 1000) }; });
        const label = (f.name || '').trim() || comps2.map(c => (c.name || '').split(' ')[0]).join(' + ');
        const _tag = doseUnitTag(f.doseUnit, dose);
        const pid = existing ? existing.peptideId : 'blend_' + uid();
        const vialId = exVial ? exVial.id : 'blv_' + uid();
        const apply = (needsReview) => {
          const totalMcg = comps2.reduce((s, c) => s + c.mcg, 0); // integer mcg sum — exact, and can never disagree with the stored components
          const conc = ml > 0
            ? { diluentMl: ml, mcgPerMl: totalMcg / ml, mcgPerUnit: totalMcg / ml / 100, unitsPerDose: dose / ((totalMcg / ml) / 100) }
            : { diluentMl: null, mcgPerMl: 0, mcgPerUnit: 0, unitsPerDose: 0 };
          const nvial = { id: vialId, peptideId: pid, peptideName: label, penComponents: comps2, mgPerVial: totalMcg / 1000, totalMcg, remainingMcg: (exVial && exVial.remainingMcg != null && exVial.totalMcg === totalMcg) ? exVial.remainingMcg : totalMcg, doseMcg: dose, ...conc, reconstitutedAt: (exVial && exVial.reconstitutedAt) || new Date().toISOString(), cycleStartDate: (exVial && exVial.cycleStartDate) || todayLocal(), cycleDays: parseInt(f.cycleDays) || 30, active: true, formType: 'liquid', inventoryProfile: (exVial && exVial.inventoryProfile) || getInventoryProfile(activeProfile) };
          setVials(prev => prev.some(v => v.id === vialId) ? prev.map(v => v.id === vialId ? { ...v, ...nvial } : v) : [nvial, ...prev]);
          const blendSched = normSched(f.sched, f.startDate);
          const protoPatch = { peptideId: pid, peptideName: label, isBlend: true, blendVialId: vialId, route: 'inj', doseMcg: dose, doseUnit: _tag.doseUnit, doseValue: _tag.doseValue, schedule: blendSched, cycleDays: parseInt(f.cycleDays) || 30, startDate: f.startDate, ...(needsReview ? { needsReview: true } : {}) };
          setProtocols(prev => existing ? prev.map(p => p.id === existing.id ? materializeProto({ ...p, ...protoPatch, timeline: undefined }, todayDk) : p) : [materializeProto({ id: uid(), profile: activeProfile, active: true, createdAt: new Date().toISOString(), ...protoPatch }, todayDk), ...prev]);
          showToast(existing ? 'Blend updated' : `Added ${label}`); closeModal();
        };
        // Dose gate: a NEW blend is a first-time compound (unique id) -> CONFIRM with implied totals;
        // edits compare against this same blend's own prior dose. Unchanged dose passes silently.
        if (existing && dose === existing.doseMcg && (f.doseUnit === 'mg' ? 'mg' : null) === (existing.doseUnit || null)) return apply(false);
        const verdict = gateProtocolSave({ peptideId: pid, peptideName: label, doseMcg: dose, doseUnit: _tag.doseUnit, route: 'inj', schedule: normSched(f.sched, f.startDate) }, existing || null, logs, protocols);
        if (verdict.decision === 'PASS') return apply(false);
        openModal(<GateDialog verdict={verdict} onConfirm={verdict.decision === 'CONFIRM' ? (() => apply(true)) : null} onCancel={closeModal}/>);
      };
      const onRemove = () => confirmModal('Delete blend?', `Remove ${existing.peptideName} and its vial?`, () => { setProtocols(prev => prev.filter(p => p.id !== existing.id)); setVials(prev => prev.filter(v => v.id !== existing.blendVialId && v.peptideId !== existing.peptideId)); showToast('Blend deleted'); }, 'Delete');
      const dl = ['S','M','T','W','T','F','S'];
      const lbl = { fontSize:11, color:'var(--text-faint)', textTransform:'uppercase', fontWeight:700, letterSpacing:'0.04em' };
      return (
        <div>
          <h3 style={{margin:'0 0 4px',fontSize:22,fontWeight:700}}>{existing ? 'Edit Blend Vial' : 'Custom Blend Vial'}</h3>
          <p style={{margin:'0 0 16px',fontSize:13,color:'var(--text-dim)'}}>Up to 4 compounds in one vial · reconstitute with BAC · dosed as total blend</p>
          <Field label="Blend name"><input value={f.name} onChange={e => setF(p => ({...p, name: e.target.value}))} placeholder="Optional — e.g. Wolverine 20/20" className="input" style={{fontSize:14}}/></Field>
          <Field label="Compounds (mg of each in the vial)">
            {f.comps.map((c, i) => (
              <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 90px auto',gap:6,marginBottom:6,alignItems:'center'}}>
                <select value={c.peptideId} onChange={e => setComp(i, { peptideId: e.target.value })} className="input" style={{padding:'10px'}}><option value="">Compound…</option>{CATEGORIES.map(cat => <optgroup key={cat} label={cat}>{PEPTIDE_DB.filter(p => p.category === cat).map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}</optgroup>)}</select>
                <input type="number" step="0.1" placeholder="mg" value={c.mg} onChange={e => setComp(i, { mg: e.target.value })} className="input" style={{padding:'10px',textAlign:'center',fontFamily:'var(--mono)'}}/>
                <button onClick={() => rmComp(i)} disabled={f.comps.length <= 1} aria-label="Remove compound" style={{width:34,height:34,borderRadius:9,border:'1px solid var(--border)',background:'var(--bg-card-2)',color:'var(--danger)',cursor:f.comps.length<=1?'default':'pointer',opacity:f.comps.length<=1?0.3:1}}>✕</button>
              </div>
            ))}
            {f.comps.length < 4 && <button onClick={addComp} style={{fontSize:12,fontWeight:700,color:'var(--accent)',background:'var(--bg-card-2)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 12px',cursor:'pointer',marginTop:2}}>+ Add compound</button>}
            {totalMg > 0 && <div style={{fontSize:12,color:'var(--text-dim)',marginTop:8}}>Vial total: <b className="mono" style={{color:'var(--text)'}}>{totalMg.toFixed(2).replace(/\.?0+$/,'')} mg</b></div>}
          </Field>
          {SOLVENT_OVERRIDE && goodComps.some(c => SOLVENT_OVERRIDE[c.peptideId]) && <div style={{fontSize:11.5,color:'var(--amber)',background:'rgba(247,140,58,0.10)',border:'1px solid rgba(247,140,58,0.25)',borderRadius:10,padding:'8px 10px',marginBottom:10}}>💡 Preferred solvent: <b>{solventNote}</b></div>}
          <Field label={`Standard dose (${f.doseUnit} of total blend)`}>
            <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,alignItems:'center'}}>
              <input type="number" value={f.doseStr} onChange={e => setF(p => ({...p, doseStr: e.target.value}))} className="input"/>
              <div style={{display:'flex',gap:4}}>{['mcg','mg'].map(u => <button key={u} type="button" onClick={() => setF(p => { if (p.doseUnit === u) return p; const v = parseFloat(p.doseStr); return {...p, doseUnit: u, doseStr: isNaN(v) ? p.doseStr : String(u === 'mg' ? v / 1000 : v * 1000)}; })} style={{padding:'0 12px',height:48,borderRadius:12,fontSize:12,fontWeight:600,fontFamily:'var(--mono)',border:'1px solid '+(f.doseUnit===u?'rgba(227,200,134,.5)':'var(--border)'),background:f.doseUnit===u?'rgba(227,200,134,.16)':'rgba(255,255,255,.04)',color:f.doseUnit===u?'var(--accent)':'var(--text-dim)',cursor:'pointer'}}>{u}</button>)}</div>
            </div>
          </Field>
          <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid var(--border)',padding:12,borderRadius:14,marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>🧪 Reconstitution</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div><label style={lbl}>Vial size (mg)</label><div className="input" style={{textAlign:'center',fontFamily:'var(--mono)',fontWeight:700,background:'rgba(255,255,255,0.04)',color:'var(--text-dim)'}}>{totalMg > 0 ? totalMg.toFixed(2).replace(/\.?0+$/,'') : '—'}</div></div>
              <div><label style={lbl}>BAC water (mL)</label><input type="number" step="0.1" value={f.reconMl} onChange={e => setF(p => ({...p, reconMl: e.target.value}))} className="input" style={{textAlign:'center',fontFamily:'var(--mono)',fontWeight:700}}/></div>
            </div>
            {m && dose > 0 ? (
              <>
                <div style={{display:'flex',alignItems:'baseline',gap:6,marginTop:10}}>
                  <span style={{fontSize:12.5,color:'var(--text-dim)'}}>Draw</span>
                  <span className="mono" style={{fontSize:20,fontWeight:700,color:(overVial||overBarrel)?'var(--amber)':'var(--accent)'}}>{m.unitsPerDose.toFixed(1)}</span>
                  <span style={{fontSize:12.5,color:'var(--text-dim)'}}>units per dose</span>
                  <span className="mono" style={{marginLeft:'auto',fontSize:11,color:'var(--text-faint)'}}>{(m.mcgPerMl/1000).toFixed(2)} mg/mL · ~{m.totalDoses} doses</span>
                </div>
                {(overVial || overBarrel) && <div style={{fontSize:11.5,color:'var(--amber)',background:'rgba(247,140,58,0.10)',border:'1px solid rgba(247,140,58,0.25)',borderRadius:10,padding:'8px 10px',marginTop:8}}>{overVial ? '⚠ Dose exceeds this vial’s total content — check amounts or dose' : '⚠ Draw exceeds a U-100 syringe (100u = 1 mL) — check amounts or BAC volume'}</div>}
                {goodComps.length > 0 && totalMg > 0 && (
                  <div style={{marginTop:10,paddingTop:8,borderTop:'1px solid var(--border-light)'}}>
                    <div style={{fontSize:11,fontWeight:800,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>In each dose</div>
                    {goodComps.map((c, i) => { const p = findPep(c.peptideId); const frac = (parseFloat(c.mg) || 0) / totalMg; return (
                      <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <span style={{fontSize:14}}>{p ? p.icon : '💊'}</span>
                        <span style={{flex:1,fontSize:12,color:'var(--text-2)'}}>{p ? p.name : c.peptideId} <span style={{color:'var(--text-faint)'}}>· {Math.round(frac*100)}%</span></span>
                        <span className="mono" style={{fontSize:13,fontWeight:800,color:'var(--accent)'}}>{fmtMcg(dose * frac)}</span>
                      </div>
                    ); })}
                  </div>
                )}
              </>
            ) : (
              <div style={{fontSize:11.5,color:'var(--text-faint)',marginTop:8}}>Enter BAC water to see the draw{totalMg > 0 ? '' : ' — add compounds first'}. Optional — you can also settle it at first log.</div>
            )}
          </div>
          <Field label="Schedule">
            <SchedulePicker value={f.sched} onChange={s => setF(p => ({ ...p, sched: s }))} anchorDefault={f.startDate} previewFrom={f.startDate}/>
          </Field>
          <Field label="Time of Day"><TimeOfDaySelect value={f.sched.timeOfDay} onChange={v => setF(p => ({ ...p, sched: { ...p.sched, timeOfDay: v } }))}/></Field>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <Field label="Cycle (days)"><input type="number" value={f.cycleDays} onChange={e => setF(p => ({...p, cycleDays: e.target.value}))} className="input"/></Field>
            <Field label="Start"><input type="date" value={f.startDate} onChange={e => setF(p => ({...p, startDate: e.target.value}))} className="input"/></Field>
          </div>
          <div style={{display:'grid',gridTemplateColumns: existing ? '1fr 1.4fr' : '1fr',gap:10,marginTop:6}}>
            {existing && <button className="btn btn-danger" onClick={onRemove}>Delete</button>}
            <button className="btn btn-primary" onClick={onSave}>{existing ? 'Save Blend' : 'Add Blend'}</button>
          </div>
        </div>
      );
    };
    openModal(<Modal/>);
  };

  // Edit protocol. opts.applyFrom = the day the schedule/dose change takes effect (defaults to the
  // viewed day, so "change from this date" works for past AND future days). The form opens with the
  // plan in force on that day; a changed plan is saved as a dated revision (see applyRevision) unless
  // the user picks "since the start", which rewrites the original plan with no history.
  const editProtocol = (p0, opts = {}) => {
    const proto = protocolsRef.current.find(x => x.id === p0.id) || p0;   // the BASE record, timeline intact
    // Pens are intentionally mcg/units-only: dose shows as syringe units (DoseCard), doseMcg is computed canonically in managePen; no mass-unit (g/mg/IU) tag applies.
    if (proto.route === 'pen') return managePen(proto);
    // Custom blend vials get their own builder (components + BAC), not the generic form.
    if (proto.isBlend || (proto.peptideId || '').indexOf('blend_') === 0) return manageBlend(proto);
    const applyFrom0 = dkValid(opts.applyFrom) ? opts.applyFrom : (dateKey !== todayDk ? dateKey : todayDk);
    const eff = protoAt(proto, applyFrom0);
    // Route default is vial-aware: a route-less protocol whose compound has a reconstituted liquid
    // vial opens the form as Injection (routeOf alone would fall through to the compound-DB string).
    const _rv = (() => { const mine = injectableVialsFor(vialsRef.current, proto.peptideId); return mine.find(x => (x.mcgPerMl || 0) > 0) || mine[0] || null; })();
    const init = { ...proto, doseMcg: eff.doseMcg, doseValue: eff.doseValue, sched: normSched(eff.schedule, applyFrom0), route: proto.route || routeOf(proto, _rv), oralUnitLabel: proto.oralUnitLabel || 'mcg', doseUnit: eff.doseUnit || 'mcg', ...reconPrefill(proto.peptideId), applyFrom: applyFrom0, applyMode: 'date', timeline: proto.timeline || [] };
    const Modal = () => {
      const [f, setF] = useState(init);
      const onSave = () => {
        const _dm = parseFloat(f.doseMcg); if (!_dm || isNaN(_dm)) return showToast('Set dose','error');
        if ((f.route || 'inj') === 'inj' && f.reconDirty) { const _hMg = parseFloat(f.reconMg) > 0, _hMl = parseFloat(f.reconMl) > 0; if (_hMg !== _hMl) return showToast(_hMg ? 'Enter BAC water (mL)' : 'Enter vial size (mg)', 'error'); }
        if (f.applyMode === 'date' && !dkValid(f.applyFrom)) return showToast('Pick the date the change applies from', 'error');
        const _tag = doseUnitTag(f.doseUnit, _dm);
        const nextSched = normSched(f.sched, f.applyFrom);
        const planChanged = !schedEq(eff.schedule, nextSched) || _dm !== eff.doseMcg || (_tag.doseUnit || null) !== (eff.doseUnit || null);
        const removedAll = (proto.timeline || []).length > 0 && !(f.timeline || []).length;
        const apply = (needsReview) => {
          setProtocols(prev => prev.map(p => {
            if (p.id !== proto.id) return p;
            let np = { ...p, route: f.route, oralPerUnitMcg: parseFloat(f.oralPerUnitMcg)||null, oralUnitLabel: f.oralUnitLabel, sprayMcgPerMl: parseFloat(f.sprayMcgPerMl)||null, sprayMlPerSpray: parseFloat(f.sprayMlPerSpray)||null, cycleDays: parseInt(f.cycleDays) || p.cycleDays, startDate: f.startDate, ...(needsReview?{needsReview:true}:{}) };
            // Revisions removed in the Plan history list
            if (removedAll) { const b = (p.timeline || []).find(e => e.from == null); if (b) TIMELINE_FIELDS.forEach(k => { if (b[k] !== undefined) np[k] = b[k]; }); delete np.timeline; }
            else if ((f.timeline || []).length) np.timeline = f.timeline;
            const fields = { schedule: nextSched, doseMcg: _dm, doseUnit: _tag.doseUnit, doseValue: _tag.doseValue };
            np = planChanged ? applyRevision(np, f.applyMode === 'start' ? null : f.applyFrom, fields, todayDk) : materializeProto(np, todayDk);
            return np;
          }));
          saveProtoRecon(f, proto.peptideId, proto.peptideName, _dm, parseInt(f.cycleDays), true);
          showToast(planChanged && f.applyMode === 'date' && f.applyFrom !== todayDk ? `Updated · new plan from ${fmtDk(f.applyFrom)}` : 'Updated');
          closeModal();
        };
        // dose gate: unchanged dose passes silently; changes confirm; ≥5×/unit-change/ceiling warn.
        if (_dm === eff.doseMcg && (f.doseUnit || null) === (eff.doseUnit || 'mcg')) return apply(false);
        const verdict = gateProtocolSave({ peptideId: proto.peptideId, peptideName: proto.peptideName, doseMcg: _dm, doseUnit: _tag.doseUnit, route: f.route, schedule: nextSched }, eff, logs, protocols);
        if (verdict.decision === 'PASS') return apply(false);
        openModal(<GateDialog verdict={verdict} onConfirm={verdict.decision === 'CONFIRM' ? (() => apply(true)) : null} onCancel={closeModal}/>);
      };
      const onRemove = () => confirmModal('Delete protocol?', `Delete ${proto.peptideName} from ${activeProfile}'s plan? Logged entries stay in History. To stop it on a date instead, use Finish cycle.`, () => { setProtocols(prev => prev.filter(p => p.id !== proto.id)); showToast('Deleted'); }, 'Delete');
      const removeRev = (id) => setF(p => { const np = removeRevision({ ...proto, timeline: p.timeline }, id, todayDk); return { ...p, timeline: np.timeline || [] }; });
      return (
        <div>
          <h3 style={{margin:'0 0 4px',fontSize:22,fontWeight:700}}>Edit Protocol</h3>
          <p style={{margin:'0 0 20px',fontSize:14,color:'var(--text-dim)'}}>{proto.peptideName}{proto.endDate ? <span style={{color:'var(--warn)'}}> · ended {fmtDk(dkOf(proto.endDate))}</span> : null}</p>
          <RouteFields f={f} setF={setF}/>
          <ReconFields f={f} setF={setF}/>
          <Field label="Schedule">
            <SchedulePicker value={f.sched} onChange={s => setF(p => ({ ...p, sched: s }))} anchorDefault={f.applyFrom} previewFrom={f.applyFrom}/>
          </Field>
          <Field label="Time of Day"><TimeOfDaySelect value={f.sched.timeOfDay} onChange={v => setF(p => ({ ...p, sched: { ...p.sched, timeOfDay: v } }))}/></Field>
          <ApplyFromPicker value={f.applyFrom} onChange={v => setF(p => ({ ...p, applyFrom: v }))} mode={f.applyMode} setMode={m => setF(p => ({ ...p, applyMode: m }))} hasTimeline={!!(f.timeline && f.timeline.length)}/>
          <TimelineList timeline={f.timeline} onRemove={removeRev}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <Field label="Cycle (days)"><input type="number" value={f.cycleDays} onChange={e => setF({...f, cycleDays: e.target.value})} className="input"/></Field>
            <Field label="Start Date"><input type="date" value={f.startDate || ''} onChange={e => setF({...f, startDate: e.target.value})} className="input"/></Field>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <button className="btn btn-danger" onClick={onRemove}>Delete</button>
            <button className="btn btn-primary" onClick={onSave}>Save</button>
          </div>
        </div>
      );
    };
    openModal(<Modal/>);
  };

  const addProtocol = (presetId) => {
    // Start = the viewed day, so adding while browsing a future (or past) day starts it there.
    let f0 = { peptideId: '', doseMcg: 0, sched: { days: ALL_DAYS.slice(), timeOfDay: 'morning' }, cycleDays: 30, startDate: dateKey, route: 'inj', oralUnitLabel: 'mcg', doseUnit: 'mcg', reconMg: '', reconMl: '', reconVialId: null };
    const Modal = () => {
      const [f, setF] = useState(f0);
      const pep = findPep(f.peptideId);
      useEffect(() => { if (presetId && !f.peptideId) apply(presetId); /* eslint-disable-next-line */ }, []); // first-run flow lands here with a compound already picked
      const apply = (id) => {
        if (id === '__new_blend__') return manageBlend(null); // hands the sheet to the blend builder
        const p = findPep(id); if (!p) return;
        const rp = reconPrefill(id);
        // Start the form in IU for IU-denominated compounds: an existing IU vial is authoritative,
        // else an equivalent protocol already dosed in IU, else the DB dose-range naming IU (HCG,
        // HGH). Explicitly reset to mcg otherwise so IU can't leak across compound switches.
        const _eq = new Set(getEquivalentIds(id));
        const iu = rp.reconIsIU || protocols.some(x => _eq.has(x.peptideId) && x.doseUnit === 'IU') || /\bIU\b/i.test((p.protocol && p.protocol.doseRange) || '');
        // Oral compounds (Anavar, tabs) open as Oral in mg; oil injectables stay Injection.
        const dbRoute = ((p.protocol && p.protocol.route) || '').toLowerCase();
        const oralDefault = /^oral$/.test(dbRoute.trim()) || /^oral\b/.test(dbRoute) && !/subq|im\b/.test(dbRoute);
        setF(prev => ({...prev, peptideId: id, doseMcg: p.protocol.defaultDoseMcg, cycleDays: p.protocol.cycleDays || 30, doseUnit: iu ? 'IU' : (p.protocol.defaultDoseMcg >= 1000 ? 'mg' : 'mcg'), route: oralDefault ? 'oral' : prev.route, oralUnitLabel: oralDefault && p.protocol.defaultDoseMcg >= 1000 ? 'mg' : prev.oralUnitLabel, ...rp}));
      };
      const onSave = () => {
        if (!f.peptideId) return showToast('Pick compound', 'error');
        if (!f.doseMcg) return showToast('Set dose', 'error');
        if ((f.route || 'inj') === 'inj' && f.reconDirty) { const _hMg = parseFloat(f.reconMg) > 0, _hMl = parseFloat(f.reconMl) > 0; if (_hMg !== _hMl) return showToast(_hMg ? 'Enter BAC water (mL)' : 'Enter vial size (mg)', 'error'); }
        if (!dkValid(f.startDate)) return showToast('Set a start date', 'error');
        const _dm = parseFloat(f.doseMcg); const _tag = doseUnitTag(f.doseUnit, _dm);
        const sched = normSched(f.sched, f.startDate);
        const apply = (needsReview) => {
          const proto = materializeProto({ id: uid(), profile: activeProfile, peptideId: f.peptideId, peptideName: pep.name, doseMcg: _dm, route: f.route, oralPerUnitMcg: parseFloat(f.oralPerUnitMcg)||null, oralUnitLabel: f.oralUnitLabel, doseUnit: _tag.doseUnit, doseValue: _tag.doseValue, sprayMcgPerMl: parseFloat(f.sprayMcgPerMl)||null, sprayMlPerSpray: parseFloat(f.sprayMlPerSpray)||null, schedule: sched, cycleDays: parseInt(f.cycleDays) || 30, startDate: f.startDate, active: true, createdAt: new Date().toISOString(), ...(needsReview?{needsReview:true}:{}) }, todayDk);
          setProtocols(prev => [proto, ...prev]);
          saveProtoRecon(f, f.peptideId, pep.name, _dm, parseInt(f.cycleDays) || 30, false);
          showToast(f.startDate > todayDk ? `Added ${pep.name} · starts ${fmtDk(f.startDate)}` : `Added ${pep.name}`); closeModal();
        };
        // dose gate: new compounds confirm with implied totals; ceiling/≥5×-vs-history warn, never wall.
        const verdict = gateProtocolSave({ peptideId: f.peptideId, peptideName: pep.name, doseMcg: _dm, doseUnit: _tag.doseUnit, route: f.route, schedule: sched }, null, logs, protocols);
        if (verdict.decision === 'PASS') return apply(false);
        openModal(<GateDialog verdict={verdict} onConfirm={verdict.decision === 'CONFIRM' ? (() => apply(true)) : null} onCancel={closeModal}/>);
      };
      const dl = ['S','M','T','W','T','F','S'];
      const inStockFps = new Set();
      vials.forEach(x => { if (x.peptideId && x.peptideId !== '__custom__') { const p = findPep(x.peptideId); if (p) inStockFps.add(compoundFingerprint(p)); } });
      const inStock = new Set(PEPTIDE_DB.filter(p => inStockFps.has(compoundFingerprint(p))).map(p => p.id));
      return (
        <div>
          <h3 style={{margin:'0 0 4px',fontSize:22,fontWeight:700}}>Add to {activeProfile}</h3>
          <p style={{margin:'0 0 20px',fontSize:14,color:'var(--text-dim)'}}>Pick a compound and schedule</p>
          <Field label="Compound">
            <select value={f.peptideId} onChange={e => apply(e.target.value)} className="input">
              <option value="" disabled>Select...</option>
              <option value="__new_blend__">🧪 Custom blend — mix up to 4 compounds in one vial…</option>
              <optgroup label="📦 On hand">{PEPTIDE_DB.filter(p => inStock.has(p.id)).map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}</optgroup>
              {CATEGORIES.map(cat => <optgroup key={cat} label={cat}>{PEPTIDE_DB.filter(p => p.category === cat && !inStock.has(p.id)).map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}</optgroup>)}
            </select>
          </Field>
          {pep && <div style={{fontSize:13,color:'var(--text-dim)',background:'rgba(255,255,255,0.04)',padding:12,borderRadius:12,border:'1px solid var(--border)',marginBottom:10}}>📖 <b style={{color:'var(--text)'}}>{pep.name}</b> · {pep.protocol.doseRange}</div>}
          <RouteFields f={f} setF={setF}/>
          {f.peptideId && <ReconFields f={f} setF={setF}/>}
          <Field label="Schedule">
            <SchedulePicker value={f.sched} onChange={s => setF(p => ({ ...p, sched: s }))} anchorDefault={f.startDate} previewFrom={f.startDate}/>
          </Field>
          <Field label="Time of Day"><TimeOfDaySelect value={f.sched.timeOfDay} onChange={v => setF(p => ({ ...p, sched: { ...p.sched, timeOfDay: v } }))}/></Field>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <Field label="Cycle (days)"><input type="number" value={f.cycleDays} onChange={e => setF({...f, cycleDays: e.target.value})} className="input"/></Field>
            <Field label="Start"><input type="date" value={f.startDate} onChange={e => setF({...f, startDate: e.target.value})} className="input"/></Field>
          </div>
          {dkValid(f.startDate) && f.startDate !== todayDk && <div style={{fontSize:11.5,color:'var(--text-faint)',margin:'-4px 2px 12px'}}>{f.startDate > todayDk ? `Appears on the schedule from ${fmtDk(f.startDate)}.` : `Back-dated start · counts as scheduled since ${fmtDk(f.startDate)}.`}</div>}
          <button className="btn btn-primary" onClick={onSave} style={{width:'100%'}}>Add Protocol</button>
        </div>
      );
    };
    openModal(<Modal/>);
  };

  const filters = [['all','All','#e3c886'],['inj','Inject',ROUTE_META.inj.color],['oral','Oral',ROUTE_META.oral.color],['nasal','Nasal',ROUTE_META.nasal.color]];
  if (mode === 'plan') return renderPlan();
  return (
    <div style={{paddingBottom:40}} className="anim-fade-in">
      {/* summary pill — text + actions only; the header ring owns adherence. Hidden for an empty profile (the empty state has its own call to action). */}
      {myProtocols.length > 0 && <div className="lg" style={{borderRadius:20, padding:'14px 16px', display:'flex', alignItems:'center', gap:14, marginBottom:16}}>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:16, fontWeight:700, color:LG.text}}>{scheduledCount === 0 ? 'Rest day' : dateKey < todayDk ? (dueCount === 0 ? 'All logged' : `${dueCount} not logged`) : `${dueCount} ${dueCount===1?'dose':'doses'} due`}</div>
          <div style={{fontSize:12.5, color:LG.dim, marginTop:2}}>{loggedCount} logged · {scheduledCount} scheduled {dateKey === todayDk ? 'today' : 'on ' + fmtDk(dateKey)}</div>
        </div>
        <button onClick={() => managePen(null)} className="lg" title="Create mix" aria-label="Create mix (up to 4 compounds)" style={{width:44, height:44, borderRadius:14, display:'grid', placeItems:'center', padding:0, cursor:'pointer'}}><Beaker size={18} color="var(--accent)"/></button>
        <button onClick={addProtocol} className="lg" aria-label="Add protocol" style={{width:42, height:42, borderRadius:14, display:'grid', placeItems:'center', padding:0, cursor:'pointer'}}><Plus size={19} color="var(--accent)"/></button>
      </div>}

      {myProtocols.length === 0 ? (
        <FirstRun activeProfile={activeProfile} onPick={(id) => addProtocol(id)} onLibrary={openLibrary}/>
      ) : (<>
        {/* C2 expired-cycle banner */}
        {expiredProtos.length > 0 && (
          <div role="region" aria-label="Cycles past end" className="card banner-expired" style={{borderRadius:18, padding:'12px 14px', marginBottom:16}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
              <AlertTriangle size={14} color="var(--warn)"/>
              <span style={{fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--warn)'}}>Cycles past end</span>
            </div>
            {expiredProtos.slice(0,3).map(p => { const n = Math.floor((Date.now() - new Date(p.startDate).getTime()) / 86400000) + 1 - p.cycleDays; return (
              <div key={p.id} style={{display:'flex', alignItems:'center', gap:8, minHeight:44}}>
                <span style={{flex:1, minWidth:0, fontSize:13, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{p.peptideName} <span style={{fontFamily:LG.mono, fontSize:11, color:'var(--warn)'}}>+{n}d</span></span>
                <button onClick={() => confirmModal('Restart cycle?', `${p.peptideName}: cycle restarts today.`, () => { setProtocols(prev => prev.map(x => x.id === p.id ? resumeProto({...x, startDate: todayDk}, todayDk) : x)); showToast('Cycle restarted'); }, 'Restart')}
                  style={{minHeight:44, padding:'0 14px', borderRadius:12, border:'1px solid rgba(227,200,134,.35)', background:'rgba(227,200,134,.12)', color:'var(--accent)', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0}}>Restart</button>
                <button onClick={() => confirmModal('Finish cycle?', `${p.peptideName} comes off the schedule after today. Logged history stays.`, () => { setProtocols(prev => prev.map(x => x.id === p.id ? finishProto(x, todayDk, todayDk) : x)); showToast('Cycle finished'); }, 'Finish')}
                  style={{minHeight:44, padding:'0 14px', borderRadius:12, border:'1px solid var(--border)', background:'rgba(255,255,255,.05)', color:'var(--text-2)', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0}}>Finish</button>
              </div>
            ); })}
            {expiredProtos.length > 3 && <div style={{fontSize:11, color:'var(--text-faint)', paddingTop:6}}>+{expiredProtos.length - 3} more</div>}
          </div>
        )}
        {/* route filter chips */}
        <div style={{display:'flex', gap:7, marginBottom:16}}>
          {filters.map(([k,label,col]) => { const active = routeFilter === k; const cnt = routeCounts[k]; return (
            <button key={k} onClick={() => setRouteFilter(k)} style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 4px', borderRadius:13, fontSize:12.5, fontWeight:600, cursor:'pointer', border:'1px solid '+(active?col+'55':LG.hair), background:active?col+'1f':'rgba(255,255,255,.04)', color:active?col:LG.dim}}>
              {label}<span style={{fontFamily:LG.mono, fontSize:11.5, fontWeight:700, color:active?col:LG.dim2}}>{cnt}</span>
            </button>
          ); })}
        </div>
        {shownProtocols.length === 0 && (
          <div style={{textAlign:'center',padding:'40px 20px',color:LG.dim}}>
            <div style={{fontSize:50,opacity:0.4,marginBottom:12}}>😴</div>
            <p style={{margin:0,fontSize:14}}>{activeProfile}'s rest day. Nothing scheduled.</p>
          </div>
        )}
        {blocks.map((b, bi) => byBlock[b.id].length > 0 && (() => {
          const items = byBlock[b.id].map(p => { const log = logs.find(l => l.protocolId === p.id && (l.datetime||'').slice(0,10) === dateKey); const status = log ? (log.skipped ? 'skipped' : 'logged') : 'pending'; return { p, log, status }; });
          const open = items.filter(it => it.status === 'pending' && !isPrn(it.p) && !isFuture && !cycleOverP(it.p)).map(it => it.p);
          const quickable = open.filter(p => quickPlan(p));
          return (
            <section key={b.id} aria-label={b.label} className="blk" style={{marginTop: bi===0?0:14}}>
              <div className="blk-hd">
                <span className="blk-title" style={{color: b.id==='prn'?LG.amber:LG.text}}>{b.label}</span>
                <span className="blk-hint">{b.hint}</span>
                <span className="blk-count mono">{b.id === 'prn' ? items.length : isFuture ? `${items.length} scheduled` : `${open.length} of ${items.length} left`}</span>
              </div>
              {items.map(it => <DoseRow key={it.p.id} proto={it.p} log={it.log} status={it.status} isFuture={isFuture} isPast={dateKey < todayDk} vials={vials} viewDateKey={dateKey}
                glow={it.p.id === glowId} celebrate={it.p.id === flashId && it.status === 'logged'} lastPrnLog={isPrn(it.p) ? lastPrnLogFor(it.p) : null}
                quick={!!quickPlan(it.p)} supply={supplyFor(it.p)} onOpen={() => administer(it.p, it.log)} onQuick={() => quickLog(it.p)}
                onUndoSkip={it.status === 'skipped' ? () => { const row = it.log; setLogs(prev => prev.filter(l => l.id !== row.id)); showToast(`Skip undone · ${it.p.peptideName}`, 'success', () => setLogs(prev => prev.some(l => l.id === row.id) ? prev : [row, ...prev])); } : null}/>)}
              {quickable.length >= 2 && (
                <div className="blk-foot">
                  <button className="btn btn-primary blk-all" onClick={() => logRemaining(open)}>Log the {quickable.length} remaining as planned</button>
                </div>
              )}
            </section>
          );
        })())}
      </>)}
    </div>
  );
}

// One row of a time block. The row opens the sheet; the pill on the right logs the planned dose in
// one tap when that is unambiguous (see quickPlan), otherwise it opens the sheet too.
function DoseRow({ proto, log, status, isFuture, isPast, vials, viewDateKey, glow, celebrate, lastPrnLog, quick, supply, onOpen, onQuick, onUndoSkip }) {
  const isPen = proto.route === 'pen';
  const pm = isPen ? (PEN_META[proto.penColor] || PEN_META.blue) : null;
  const penVial = isPen ? (vials || []).find(v => v.id === proto.penVialId) : null;
  const sched = proto.schedule || {};
  const viewDk = viewDateKey || todayLocal();
  const startDk = dkOf(proto.startDate);
  const elapsed = dkValid(startDk) ? dkDiff(viewDk, startDk) : 0;
  const equivIds = new Set(getEquivalentIds(proto.peptideId));
  const activeVial = isPen ? penVial : ((vials || []).find(v => equivIds.has(v.peptideId) && v.active !== false && (v.mcgPerMl||0) > 0) || (vials || []).find(v => equivIds.has(v.peptideId) && v.active !== false));
  const route = isPen ? 'inj' : routeOf(proto, activeVial);
  const rt = ROUTE_META[route] || ROUTE_META.inj;
  const mcgPerUnit = activeVial && activeVial.mcgPerMl ? activeVial.mcgPerMl / 100 : 0;
  const dMcg = (log && !log.skipped && log.doseMcg != null) ? log.doseMcg : proto.doseMcg; // a skip row carries 0; the row keeps showing the plan
  const units = mcgPerUnit ? dMcg / mcgPerUnit : ((isPen && penVial && penVial.unitsPerDose) || null);
  const du0 = (log && log.doseUnit) || proto.doseUnit;
  const isIU = du0 === 'IU' || isIUVial(activeVial);
  let dv, du;
  if (isIU) { dv = String(Math.round(log && log.doseValue != null ? log.doseValue : dMcg)); du = 'IU'; }
  else if (du0 === 'g') { dv = (dMcg/1e6).toFixed(2).replace(/\.?0+$/,''); du = 'g'; }
  else if (du0 === 'mg' || dMcg >= 1000) { dv = (dMcg/1000).toFixed(2).replace(/\.?0+$/,''); du = 'mg'; }
  else { dv = String(Math.round(dMcg)); du = 'mcg'; }
  const ml = (log && log.doseMl != null) ? log.doseMl : (activeVial && activeVial.mcgPerMl ? dMcg / activeVial.mcgPerMl : null);
  const deliver = (!isPen && (route === 'oral' || route === 'nasal')) ? deliveryFor({ ...proto, doseMcg: dMcg }, activeVial).chip : null;
  const isPrnProto = isPrnSched(sched);
  const cycleOver = (proto.cycleDays > 0) && !isPrnProto && !proto.endDate && (elapsed + 1 > proto.cycleDays);
  // precedence: logged > skipped > expired > future > prn > missed (past day) > due
  const state = status === 'logged' ? 'logged' : status === 'skipped' ? 'skipped' : cycleOver ? 'expired' : isFuture ? 'future' : isPrnProto ? 'prn' : isPast ? 'missed' : 'due';
  const logTime = (() => { if (!log || !log.datetime) return ''; const d = new Date(log.datetime); if (isNaN(d.getTime())) return ''; let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0'); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return h + ':' + m + ap; })();
  const prnRel = (() => { if (!lastPrnLog || !lastPrnLog.datetime) return 'never'; const d = new Date(lastPrnLog.datetime); if (isNaN(d.getTime())) return 'never'; const n = Math.floor((Date.now() - d.getTime()) / 86400000); return n <= 0 ? 'today' : n === 1 ? '1d ago' : n + 'd ago'; })();
  const endDk = dkOf(proto.endDate);
  const nextRev = nextRevision(proto, viewDk);
  const hint = (dkValid(endDk) && dkDiff(endDk, viewDk) <= 7 && dkDiff(endDk, viewDk) >= 0) ? ('ends ' + fmtDk(endDk))
    : (nextRev && dkDiff(nextRev.from, viewDk) <= 14) ? (schedLabel(nextRev.schedule, true) + ' from ' + fmtDk(nextRev.from)) : null;
  const name = isPen ? (penLabelOf(proto) + ' · ' + ((((penVial && penVial.penComponents) || []).map(c => (c.name || '').split(' ')[0]).join(' + ')) || 'Empty pen')) : proto.peptideName;
  const doseLine = [units != null ? `${Math.round(units * 10) / 10} u` : null, isPen ? null : `${dv} ${du}`, (ml != null && units != null) ? `${(+ml).toFixed(ml < 0.1 ? 3 : 2)} mL` : null, deliver].filter(Boolean).join(' · ');
  const sub = state === 'logged' ? `Logged ${logTime}` : state === 'skipped' ? 'Skipped' : state === 'expired' ? `Cycle ended ${elapsed + 1 - proto.cycleDays}d ago`
    : state === 'future' ? 'Scheduled' : state === 'prn' ? `As needed · last ${prnRel}` : state === 'missed' ? 'Not logged' : (hint || schedLabel(sched, true));
  const cel = !!celebrate && state === 'logged';
  const disc = state === 'logged' ? 'done' : state === 'skipped' ? 'skip' : state === 'expired' ? 'exp' : state === 'future' ? 'fut' : 'due';
  return (
    <div className={'blk-row' + (glow && state === 'due' ? ' glow' : '') + (state === 'logged' ? ' is-logged' : state === 'skipped' ? ' is-skipped' : '')}>
      <button className="blk-main" onClick={onOpen} style={isPen ? { boxShadow: 'inset 3px 0 0 ' + pm.color, paddingLeft: 10 } : undefined}>
        <span className={'blk-disc ' + disc} aria-hidden="true">
          {cel ? <span className="cel-disc"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path className="cel-ck" d="M7 13.5l3.8 3.8L19 9.5" stroke="#06231a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
            : state === 'logged' ? <Check size={14} strokeWidth={3} color="#06231a"/>
            : state === 'skipped' ? <span style={{fontSize:12,color:LG.amber}}>⏭</span>
            : state === 'expired' ? <span style={{fontSize:13,color:LG.amber}}>↻</span>
            : <RouteIcon route={route} color={rt.color} s={13}/>}
        </span>
        <span className="blk-text">
          <span className="blk-name">{name}</span>
          <span className="blk-dose mono">{doseLine}{doseLine && sub ? ' · ' : ''}<span className={'blk-sub' + (state === 'logged' ? ' ok' : (state === 'skipped' || state === 'expired' || state === 'missed') ? ' warn' : '')}>{sub}</span>{supply && supply.dosesLeft <= 3 && state !== 'logged' ? <span className="blk-sub warn">{` · ${supply.dosesLeft} left`}</span> : null}</span>
        </span>
      </button>
      {(state === 'due' || state === 'missed') ? <button className="pill-log" aria-label={quick ? 'Log as planned' : 'Open to log'} title={proto.peptideName} onClick={onQuick}>{quick ? 'Log' : 'Log…'}</button>
       : state === 'prn' ? <button className="pill-log ghost" aria-label="Log a dose" title={proto.peptideName} onClick={onOpen}>Log</button>
       : (state === 'skipped' && onUndoSkip) ? <button className="pill-log ghost" aria-label="Undo skip" title={proto.peptideName} onClick={onUndoSkip}>Undo</button>
       : null}
    </div>
  );
}

// ── Dose-gate dialogs. Warnings inform; they never wall. The only dialog with
// no override path is a missing/invalid dose (nothing to write). ──
function GateDialog({ verdict, onConfirm, onCancel }) {
  const block = verdict.decision === 'BLOCK';
  const warn = verdict.severity === 'warn';
  const firedRef = useRef(false); // double-tap latch: one confirm tap commits at most once
  const confirmOnce = onConfirm ? (() => { if (firedRef.current) return; firedRef.current = true; onConfirm(); }) : null;
  return (
    <div role="alertdialog" aria-modal="true" aria-label={block ? 'Dose cannot be logged' : warn ? 'Dose warning' : 'Confirm this dose'}>
      <div style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:14}}>
        <div style={{width:44,height:44,borderRadius:14,flexShrink:0,display:'grid',placeItems:'center',
          background: block ? 'rgba(255,107,107,.12)' : 'rgba(247,140,58,.12)',
          boxShadow:'inset 0 0 0 1px ' + (block ? 'rgba(255,107,107,.35)' : 'rgba(247,140,58,.35)')}}>
          <ShieldAlert size={20} color={block ? 'var(--danger)' : 'var(--warn)'}/>
        </div>
        <div>
          <h3 style={{margin:0,fontSize:19,fontWeight:700}}>{block ? 'Dose can’t be read' : warn ? 'Dose warning' : 'Confirm this dose'}</h3>
          <p style={{margin:'6px 0 0',fontSize:14,lineHeight:1.45,color:'var(--text-2)'}}>{verdict.message}</p>
        </div>
      </div>
      {(verdict.impliedPerDoseMcg != null) && (
        <div className="card" style={{padding:'10px 14px',marginBottom:14,fontFamily:'var(--mono)',fontSize:13,color:'var(--text)'}}>
          {fmtMcg(verdict.impliedPerDoseMcg)} / dose{verdict.impliedWeeklyMcg != null ? ` · ${fmtMcg(verdict.impliedWeeklyMcg)} / week` : ''}
        </div>
      )}
      {block ? (
        <>
          <p style={{margin:'0 0 14px',fontSize:12.5,color:'var(--text-dim)'}}>There’s no usable number to log — go back and enter the dose.</p>
          <button className="btn btn-ghost" style={{width:'100%',height:48}} onClick={onCancel}>Close</button>
        </>
      ) : (
        <>
          {warn && <p style={{margin:'0 0 12px',fontSize:12.5,color:'var(--text-dim)'}}>This is a warning, not a wall. Log it if it’s what you meant — the entry is flagged for review so peptide-tracker sees it.</p>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <button className="btn btn-ghost" style={{height:48}} onClick={onCancel}>Cancel</button>
            <button className="btn btn-primary" style={{height:48}} onClick={confirmOnce}>{warn ? 'Log anyway' : 'Log — flagged for review'}</button>
          </div>
        </>
      )}
    </div>
  );
}
// Gate for protocol create/edit. First-time compounds (no history anywhere) get a plain
// CONFIRM — protocol creation IS how compounds legitimately enter this app. Every other
// gate reason (ceiling, ≥5×, unit change) comes through softenVerdict as a warning you
// can override; none of them stop the save.
function gateProtocolSave(nextProto, priorProto, logs, allProtocols) {
  const ids = new Set(getEquivalentIds(nextProto.peptideId));
  const priorLog = (logs || []).find(l => ids.has(l.peptideId) && !l.skipped && l.doseMcg > 0);
  const sibling = (allProtocols || []).find(p => ids.has(p.peptideId) && p.doseMcg > 0);
  const known = !!(priorProto || priorLog || sibling);
  const sched = nextProto.schedule || { days: nextProto.days || [0,1,2,3,4,5,6] };
  const v = evaluateDose({
    peptideId: nextProto.peptideId, peptideName: nextProto.peptideName,
    doseMcg: nextProto.doseMcg, doseUnit: nextProto.doseUnit || null,
    route: nextProto.route || null, frequencyPerWeek: freqPerWeek(sched),
  }, {
    knownCompound: known,
    priorDoseMcg: priorProto ? priorProto.doseMcg : (sibling ? sibling.doseMcg : (priorLog ? priorLog.doseMcg : null)),
    priorUnit: priorProto ? (priorProto.doseUnit || null) : null,
    priorFrequencyPerWeek: priorProto && priorProto.schedule ? freqPerWeek(priorProto.schedule) : null,
  });
  if (v.decision === 'BLOCK' && v.reasons.length === 1 && /unknown\/first-time/.test(v.reasons[0])) {
    return { ...v, decision: 'CONFIRM', needsReview: true,
      message: 'CONFIRM — first protocol for ' + (nextProto.peptideName || nextProto.peptideId) +
        '. Entered ≈ ' + fmtMcg(v.impliedPerDoseMcg || 0) + '/dose' +
        (v.impliedWeeklyMcg != null ? ', ' + fmtMcg(v.impliedWeeklyMcg) + '/week' : '') +
        '. Settle new compounds with Claude (peptide-tracker) when in doubt.' };
  }
  return softenVerdict(v);
}

function Field({ label, children }) { return <div style={{marginBottom:10}}>{label && <label style={{fontSize:12,color:'var(--text-dim)',fontWeight:600,display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em'}}>{label}</label>}{children}</div>; }

// ══════════ History tab — every logged entry for the profile, filterable, downloadable, editable ══════════
function HistoryView({ logs, setLogs, protocols, vials, activeProfile, openModal, closeModal, confirmModal, showToast, onJump, exportCSV, exportJSON }) {
  const today = todayLocal();
  const [range, setRange] = useState('30');            // '7' | '30' | '90' | 'all' | 'custom'
  const [from, setFrom] = useState(() => dkAdd(today, -29));
  const [to, setTo] = useState(() => today);
  const [comp, setComp] = useState('all');
  const [showSkipped, setShowSkipped] = useState(false);
  const nameOf = (l) => l.peptide || l.peptideName || l.peptideId || '?';
  const mine = useMemo(() => logs.filter(l => (l.profile || activeProfile) === activeProfile), [logs, activeProfile]);
  const compounds = useMemo(() => { const m = {}; mine.forEach(l => { if (l.skipped) return; const n = nameOf(l); m[n] = (m[n] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); }, [mine]);
  const lo = range === 'all' ? '0000-00-00' : range === 'custom' ? (dkValid(from) ? from : '0000-00-00') : dkAdd(today, -(parseInt(range) - 1));
  const hi = range === 'custom' ? (dkValid(to) ? to : '9999-12-31') : '9999-12-31';
  const filtered = useMemo(() => mine.filter(l => {
    const dk = dkOf(l.datetime) || '';
    if (dk < lo || dk > hi) return false;
    if (!showSkipped && l.skipped) return false;
    if (comp !== 'all' && nameOf(l) !== comp) return false;
    return true;
  }).sort((a, b) => (b.datetime || '').localeCompare(a.datetime || '')), [mine, lo, hi, comp, showSkipped]);
  const groups = useMemo(() => { const g = []; let cur = null; filtered.forEach(l => { const dk = dkOf(l.datetime); if (!cur || cur.dk !== dk) { cur = { dk, items: [] }; g.push(cur); } cur.items.push(l); }); return g; }, [filtered]);
  // Paged list: the newest 150 rows mount at once, older ones on request (two years of logs used to mount ~40k nodes).
  const PAGE = 150;
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => { setLimit(PAGE); }, [range, from, to, comp, showSkipped]);
  const paged = useMemo(() => { const out = []; let n = 0; for (const g of groups) { if (n >= limit) break; const items = g.items.slice(0, limit - n); out.push({ dk: g.dk, items }); n += items.length; } return { groups: out, shown: n }; }, [groups, limit]);
  const doses = filtered.filter(l => !l.skipped).length;
  const compCount = new Set(filtered.filter(l => !l.skipped).map(nameOf)).size;
  const dayCount = groups.filter(g => g.items.some(l => !l.skipped)).length;
  // Adherence by compound over the selected range: scheduled days only (as-needed compounds excluded),
  // capped at 400 days so the all-time range stays cheap. Same engine rules as Today and the Worker.
  const adherence = useMemo(() => {
    const start = (range === 'all' || lo < '1000') ? dkAdd(today, -364) : lo;
    const end = hi > today ? today : hi;
    if (!dkValid(start) || !dkValid(end) || start > end) return { rows: [], exp: 0, got: 0, pct: null };
    const nDays = Math.min(400, dkDiff(end, start) + 1);
    const byProto = {}; mine.forEach(l => { if (!l.skipped) { const dk = dkOf(l.datetime); (byProto[l.protocolId] = byProto[l.protocolId] || new Set()).add(dk); } });
    const rows = [];
    protocols.filter(p => p.profile === activeProfile && !isPrnSched(p.schedule)).forEach(p => {
      let exp = 0, got = 0;
      for (let i = 0; i < nDays; i++) { const dk = dkAdd(end, -i); if (!activeOn(p, dk) || !dueOn(protoAt(p, dk), dk)) continue; exp++; if (byProto[p.id] && byProto[p.id].has(dk)) got++; }
      if (exp) rows.push({ id: p.id, name: p.peptideName, exp, got, pct: Math.round(got / exp * 100) });
    });
    rows.sort((a, b) => a.pct - b.pct || b.exp - a.exp);
    const exp = rows.reduce((s, r) => s + r.exp, 0), got = rows.reduce((s, r) => s + r.got, 0);
    return { rows, exp, got, pct: exp ? Math.round(got / exp * 100) : null };
  }, [mine, protocols, activeProfile, lo, hi, range, today]);
  const adhColor = (pct) => pct >= 90 ? 'var(--success)' : pct >= 70 ? 'var(--accent)' : 'var(--warn)';
  const protoFor = (l) => protocols.find(p => p.id === l.protocolId) || null;
  const routeFor = (l) => { const p = protoFor(l); const v = l.vialId ? vials.find(x => x.id === l.vialId) : null; if (p && p.route === 'pen') return 'inj'; return p ? routeOf(p, v) : (v && v.formType === 'oral' ? 'oral' : 'inj'); };
  const doseStr = (l) => { if (l.skipped) return 'skipped'; if (l.doseUnit) return fmtDoseAny(l.doseMcg, l.doseUnit); const p = protoFor(l); return fmtDoseAny(l.doseMcg, (p && p.doseUnit) || null); };
  const timeStr = (l) => { const d = new Date(l.datetime); return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  const dayTitle = (dk) => { const t = dkParse(dk); if (isNaN(t)) return dk || 'Unknown day'; if (dk === today) return 'Today'; if (dk === dkAdd(today, -1)) return 'Yesterday'; return new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC', ...(dk.slice(0,4) === today.slice(0,4) ? {} : { year: 'numeric' }) }); };
  const rangeLabel = range === 'all' ? 'all time' : range === 'custom' ? `${fmtDk(lo)} – ${fmtDk(hi)}` : `last ${range} days`;
  const removeLog = (l) => confirmModal('Delete entry?', `${nameOf(l)} · ${dayTitle(dkOf(l.datetime))} ${timeStr(l)}`, () => {
    setLogs(prev => prev.filter(x => x.id !== l.id));
    showToast('Entry deleted', 'success', () => setLogs(prev => prev.some(x => x.id === l.id) ? prev : [l, ...prev]));
  }, 'Delete');
  const removeShown = () => confirmModal(`Delete ${filtered.length} entries?`, `${comp} · ${rangeLabel}. Undo is available on the toast for a few seconds.`, () => {
    const ids = new Set(filtered.map(l => l.id)); const removed = filtered;
    setLogs(prev => prev.filter(x => !ids.has(x.id)));
    showToast(`Deleted ${removed.length} entries`, 'success', () => setLogs(prev => { const have = new Set(prev.map(x => x.id)); return [...removed.filter(x => !have.has(x.id)), ...prev]; }));
  }, 'Delete all');
  const openRow = (l) => {
    const p = protoFor(l); const route = routeFor(l); const rt = ROUTE_META[route] || ROUTE_META.inj;
    openModal(
      <div>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
          <div style={{width:44,height:44,borderRadius:13,background:rt.color+'24',display:'grid',placeItems:'center',boxShadow:'inset 0 0 0 1px '+rt.color+'40',flexShrink:0}}><RouteIcon route={route} color={rt.color} s={22}/></div>
          <div style={{minWidth:0}}>
            <h3 style={{margin:0,fontSize:19,fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{nameOf(l)}</h3>
            <div style={{fontSize:13,color:'var(--text-dim)',marginTop:2}}>{dayTitle(dkOf(l.datetime))} · {timeStr(l)}</div>
          </div>
        </div>
        <div className="card" style={{padding:'12px 14px',marginBottom:12,display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div><div style={{fontSize:9.5,color:'var(--text-faint)',textTransform:'uppercase',fontWeight:700,letterSpacing:'0.06em'}}>Dose</div><div className="mono" style={{fontSize:16,fontWeight:700,color:l.skipped?'var(--warn)':'var(--accent)',marginTop:2}}>{doseStr(l)}</div></div>
          <div><div style={{fontSize:9.5,color:'var(--text-faint)',textTransform:'uppercase',fontWeight:700,letterSpacing:'0.06em'}}>Draw</div><div className="mono" style={{fontSize:16,fontWeight:700,color:'var(--text)',marginTop:2}}>{l.doseMl != null ? `${(l.doseMl*100).toFixed(1)}u · ${l.doseMl} mL` : '—'}</div></div>
          {(l.notes || l.needsReview || l.backfilled) && <div style={{gridColumn:'1 / -1',fontSize:12,color:'var(--text-dim)',lineHeight:1.4}}>{l.backfilled ? '↩ back-dated entry · ' : ''}{l.needsReview ? '⚑ flagged for review · ' : ''}{l.notes || ''}</div>}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <button className="btn btn-danger" style={{height:48}} onClick={() => { closeModal(); removeLog(l); }}>Delete</button>
          <button className="btn btn-primary" style={{height:48}} disabled={!p} onClick={() => { closeModal(); onJump(dkOf(l.datetime), l.protocolId, l.skipped ? null : l.id); }}>{p ? (l.skipped ? 'Open that day' : 'Edit dose / time') : 'No protocol'}</button>
        </div>
      </div>
    );
  };
  const addBackdated = () => openModal(<BackdateSheet protocols={protocols.filter(p => p.profile === activeProfile && p.route !== 'pen')} logs={logs} vials={vials} onClose={closeModal}
    onSave={(newLogs) => { setLogs(prev => { const have = new Set(prev.map(x => x.id)); return [...newLogs.filter(x => !have.has(x.id)), ...prev]; }); showToast(`Added ${newLogs.length} back-dated ${newLogs.length === 1 ? 'entry' : 'entries'}`, 'success', () => { const ids = new Set(newLogs.map(x => x.id)); setLogs(prev => prev.filter(x => !ids.has(x.id))); }); closeModal(); }}/>);
  const stat = (n, label) => <div style={{flex:1,textAlign:'center'}}><div className="mono" style={{fontSize:22,fontWeight:700,color:'var(--text)',lineHeight:1}}>{n}</div><div style={{fontSize:9.5,color:'var(--text-faint)',textTransform:'uppercase',letterSpacing:'0.06em',marginTop:4}}>{label}</div></div>;
  return (
    <div style={{paddingBottom:40}}>
      <div className="lg" style={{borderRadius:20,padding:'14px 16px',marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:16,fontWeight:700,color:LG.text}}>Logged data</div>
            <div style={{fontSize:12.5,color:LG.dim,marginTop:2}}>{activeProfile} · {rangeLabel}{comp !== 'all' ? ' · ' + comp : ''}</div>
          </div>
          <button onClick={addBackdated} className="lg" aria-label="Add back-dated entries" title="Add back-dated entries" style={{width:42,height:42,borderRadius:14,display:'grid',placeItems:'center',padding:0,cursor:'pointer',fontSize:17}}>↩</button>
        </div>
        <div style={{display:'flex',gap:8,marginTop:14,paddingTop:12,borderTop:'1px solid '+LG.hair}}>{stat(doses, 'doses')}{stat(compCount, 'compounds')}{stat(dayCount, 'days')}</div>
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <button className="btn btn-ghost" style={{flex:1,minHeight:40,fontSize:12}} onClick={() => exportCSV(filtered)} disabled={!filtered.length}>⬇ CSV · {filtered.length}</button>
          <button className="btn btn-ghost" style={{flex:1,minHeight:40,fontSize:12}} onClick={() => exportJSON(filtered)} disabled={!filtered.length}>⬇ JSON · {filtered.length}</button>
        </div>
      </div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
        {[['7','7 days'],['30','30 days'],['90','90 days'],['all','All'],['custom','Custom']].map(([k,l]) => <button key={k} onClick={() => setRange(k)} style={chipSt(range === k)}>{l}</button>)}
        <button onClick={() => setShowSkipped(s => !s)} style={chipSt(showSkipped, true)}>Skipped {showSkipped ? 'shown' : 'hidden'}</button>
      </div>
      {range === 'custom' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input" aria-label="From"/>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input" aria-label="To"/>
        </div>
      )}
      <select value={comp} onChange={e => setComp(e.target.value)} className="input" style={{marginBottom:16}} aria-label="Compound filter">
        <option value="all">All compounds ({compounds.length})</option>
        {compounds.map(([n, c]) => <option key={n} value={n}>{n} · {c}</option>)}
      </select>
      {adherence.rows.length > 0 && (
        <section className="blk" aria-label="Adherence by compound" style={{marginBottom:14}}>
          <div className="blk-hd"><span className="blk-title">Adherence</span><span className="blk-hint">{rangeLabel}</span><span className="blk-count mono" style={{color: adhColor(adherence.pct)}}>{adherence.pct}% · {adherence.got} of {adherence.exp}</span></div>
          <div style={{display:'flex',flexDirection:'column',gap:7,padding:'2px 2px 8px'}}>
            {(comp === 'all' ? adherence.rows : adherence.rows.filter(r => r.name === comp)).map(r => (
              <div key={r.id} style={{display:'grid',gridTemplateColumns:'minmax(0,112px) 1fr 44px',gap:10,alignItems:'center'}}>
                <span style={{fontSize:12.5,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={r.name}>{r.name}</span>
                <div style={{height:10,borderRadius:5,background:'rgba(255,255,255,.07)',overflow:'hidden'}} role="img" aria-label={`${r.name}: ${r.got} of ${r.exp} doses, ${r.pct} percent`}><div style={{width:r.pct+'%',height:'100%',borderRadius:5,background: adhColor(r.pct)}}/></div>
                <span className="mono" style={{fontSize:12,fontWeight:700,textAlign:'right',color: adhColor(r.pct)}}>{r.pct}%</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {groups.length === 0 ? (
        <div style={{textAlign:'center',padding:'50px 20px',color:LG.dim}}>
          <div style={{fontSize:50,opacity:0.4,marginBottom:12}}>🗒</div>
          <p style={{margin:'0 0 16px',fontSize:14}}>Nothing logged for {activeProfile} in this range.</p>
          <button className="btn btn-ghost" onClick={addBackdated}>↩ Add back-dated entries</button>
        </div>
      ) : paged.groups.map(g => (
        <div key={g.dk} style={{marginBottom:14}}>
          <div style={{display:'flex',alignItems:'baseline',gap:8,padding:'0 4px 8px'}}>
            <span style={{fontSize:13,fontWeight:700,color:LG.text}}>{dayTitle(g.dk)}</span>
            <span className="mono" style={{fontSize:11,color:LG.dim2}}>{g.items.filter(l => !l.skipped).length} {g.items.filter(l => !l.skipped).length === 1 ? 'dose' : 'doses'}</span>
            <div style={{flex:1,height:1,background:LG.hair,alignSelf:'center'}}/>
          </div>
          <div className="card" style={{padding:'2px 12px'}}>
            {g.items.map((l, i) => { const route = routeFor(l); const rt = ROUTE_META[route] || ROUTE_META.inj; return (
              <button key={l.id || i} onClick={() => openRow(l)} style={{display:'flex',alignItems:'center',gap:10,width:'100%',minHeight:50,padding:'8px 0',border:'none',borderTop: i ? '1px solid var(--border-light)' : 'none',background:'transparent',color:'var(--text)',textAlign:'left',cursor:'pointer'}}>
                <div style={{width:28,height:28,borderRadius:9,background:rt.color+'24',display:'grid',placeItems:'center',boxShadow:'inset 0 0 0 1px '+rt.color+'40',flexShrink:0,opacity:l.skipped?0.5:1}}><RouteIcon route={route} color={rt.color} s={15}/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13.5,fontWeight:600,color:l.skipped?'var(--text-dim)':'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{nameOf(l)}</div>
                  <div style={{fontSize:11,color:'var(--text-dim)',marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{timeStr(l)}{l.doseMl != null ? ` · ${(l.doseMl*100).toFixed(1)}u` : ''}{l.site ? ` · ${l.site}` : ''}{l.backfilled ? ' · ↩ back-dated' : ''}{l.needsReview ? ' · ⚑' : ''}{l.notes && !l.backfilled ? ` · ${l.notes}` : ''}</div>
                </div>
                <span className="mono" style={{fontSize:13,fontWeight:700,color:l.skipped?'var(--warn)':'var(--accent)',whiteSpace:'nowrap'}}>{doseStr(l)}</span>
              </button>
            ); })}
          </div>
        </div>
      ))}
      {paged.shown < filtered.length && (
        <button className="btn btn-ghost" style={{width:'100%',minHeight:44,marginBottom:10}} onClick={() => setLimit(l => l + 300)}>Show earlier · {filtered.length - paged.shown} more</button>
      )}
      {comp !== 'all' && filtered.length > 0 && (
        <button className="btn btn-danger" style={{width:'100%',marginTop:6}} onClick={removeShown}>Delete these {filtered.length} entries · {comp}</button>
      )}
    </div>
  );
}
// Back-dated entries over a date range for one protocol (also what the one-time migrations use).
function BackdateSheet({ protocols, logs, vials, onSave, onClose }) {
  const today = todayLocal();
  const list = protocols.slice().sort((a, b) => (a.active === false) - (b.active === false) || (a.peptideName || '').localeCompare(b.peptideName || ''));
  const [pid, setPid] = useState(list[0] ? list[0].id : '');
  const p = list.find(x => x.id === pid) || null;
  const [from, setFrom] = useState(dkAdd(today, -7));
  const [to, setTo] = useState(dkAdd(today, -1));
  const [time, setTime] = useState('08:00');
  const [onlySched, setOnlySched] = useState(true);
  const [doseStr, setDoseStr] = useState('');
  const [notes, setNotes] = useState('');
  const unit = p ? (p.doseUnit || 'mcg') : 'mcg';
  const factor = unit === 'g' ? 1e6 : unit === 'mg' ? 1000 : 1;
  const doseMcg = doseStr.trim() === '' ? undefined : Math.round((parseFloat(doseStr) || 0) * factor);
  const vial = p ? (vials || []).find(v => v.peptideId === p.peptideId && v.active !== false && (v.mcgPerMl || 0) > 0) : null;
  const preview = (p && dkValid(from) && dkValid(to)) ? buildBackfillLogs(p, from, to, { onlyScheduled: onlySched, time, doseMcg, doseUnit: unit === 'mcg' ? null : unit, mcgPerMl: vial ? vial.mcgPerMl : 0, vialId: vial ? vial.id : null, notes: notes.trim() || 'Back-dated entry' }, logs) : [];
  const spanDays = (dkValid(from) && dkValid(to) && from <= to) ? dkDiff(to, from) + 1 : 0;
  const skippedExisting = spanDays - preview.length;
  return (
    <div>
      <h3 style={{margin:'0 0 4px',fontSize:22,fontWeight:700}}>Back-dated entries</h3>
      <p style={{margin:'0 0 16px',fontSize:13,color:'var(--text-dim)'}}>Log doses you took but didn’t record. Days that already have an entry (or a skip) are left alone.</p>
      <Field label="Compound">
        <select value={pid} onChange={e => { setPid(e.target.value); setDoseStr(''); }} className="input">
          {list.map(x => <option key={x.id} value={x.id}>{x.peptideName}{x.active === false || x.endDate ? ' · finished' : ''}</option>)}
          {!list.length && <option value="">No protocols yet</option>}
        </select>
      </Field>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
        <Field label="From"><input type="date" value={from} max={today} onChange={e => setFrom(e.target.value)} className="input"/></Field>
        <Field label="To"><input type="date" value={to} max={today} onChange={e => setTo(e.target.value)} className="input"/></Field>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
        <Field label="Time"><input type="time" value={time} onChange={e => setTime(e.target.value)} className="input"/></Field>
        <Field label={`Dose (${unit})`}><input type="number" inputMode="decimal" placeholder={p ? String(unit === 'IU' ? p.doseMcg : (p.doseMcg || 0) / factor) : ''} value={doseStr} onChange={e => setDoseStr(e.target.value)} className="input"/></Field>
      </div>
      <div style={{display:'flex',gap:6,marginBottom:10}}>
        <button type="button" onClick={() => setOnlySched(true)} style={chipSt(onlySched)}>Scheduled days only</button>
        <button type="button" onClick={() => setOnlySched(false)} style={chipSt(!onlySched)}>Every day</button>
      </div>
      <Field label="Note (optional)"><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. taken, forgot to log" className="input"/></Field>
      <div className="lg" style={{borderRadius:14,padding:'10px 12px',marginBottom:14,fontSize:12.5,color:'var(--text-dim)'}}>
        {!p ? 'Pick a compound.' : !spanDays ? 'Pick a valid date range.' : <>Will add <b className="mono" style={{color:'var(--accent)'}}>{preview.length}</b> {preview.length === 1 ? 'entry' : 'entries'} for <b style={{color:'var(--text)'}}>{p.peptideName}</b>{preview.length ? <> at <b className="mono" style={{color:'var(--text)'}}>{fmtDoseAny(preview[0].doseMcg, preview[0].doseUnit)}</b>{preview[0].doseMl != null ? ` (${(preview[0].doseMl*100).toFixed(1)}u)` : ''}</> : null}{skippedExisting > 0 ? ` · ${skippedExisting} ${skippedExisting === 1 ? 'day' : 'days'} skipped (already logged${onlySched ? ' or not scheduled' : ''})` : ''}.</>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1.4fr',gap:10}}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!preview.length} onClick={() => onSave(preview)}>Add {preview.length || ''} {preview.length === 1 ? 'entry' : 'entries'}</button>
      </div>
    </div>
  );
}

function LabView({ vials }) {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const filtered = useMemo(() => {
    let items = PEPTIDE_DB;
    if (filter !== 'All') items = items.filter(p => p.category === filter);
    if (search) { const s = search.toLowerCase(); items = items.filter(p => p.name.toLowerCase().includes(s) || p.purpose.toLowerCase().includes(s)); }
    return items;
  }, [filter, search]);
  const inStockFps = new Set();
  vials.forEach(x => { if (x.peptideId && x.peptideId !== '__custom__') { const p = findPep(x.peptideId); if (p) inStockFps.add(compoundFingerprint(p)); } });
  const isInStock = (p) => inStockFps.has(compoundFingerprint(p));
  return (
    <div style={{paddingBottom:40}}>
      <div style={{margin:'8px 0 14px'}}><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search compounds..." className="input"/></div>
      <div style={{display:'flex',gap:6,overflowX:'auto',marginBottom:16,paddingBottom:4}} className="hide-scrollbar">
        <button onClick={() => setFilter('All')} style={{padding:'8px 14px',borderRadius:100,border:'1px solid var(--border)',background:filter==='All'?'rgba(227,200,134,0.15)':'rgba(255,255,255,0.04)',color:filter==='All'?'var(--accent-2)':'var(--text-dim)',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>All ({PEPTIDE_DB.length})</button>
        {CATEGORIES.map(c => { const n = PEPTIDE_DB.filter(p => p.category === c).length; return <button key={c} onClick={() => setFilter(c)} style={{padding:'8px 14px',borderRadius:100,border:'1px solid var(--border)',background:filter===c?'rgba(227,200,134,0.15)':'rgba(255,255,255,0.04)',color:filter===c?'var(--accent-2)':'var(--text-dim)',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>{c} ({n})</button>; })}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {filtered.map(p => {
          const open = expanded === p.id;
          const inStock = isInStock(p);
          return (
            <div key={p.id} className="card" style={{padding:16}}>
              <div onClick={() => setExpanded(open ? null : p.id)} style={{cursor:'pointer',display:'flex',gap:12,alignItems:'flex-start'}}>
                <div style={{fontSize:28}}>{p.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <span style={{fontSize:16,fontWeight:700}}>{p.name}</span>
                    {inStock && <span className="chip chip-green" style={{fontSize:9,padding:'2px 7px'}}>On hand</span>}
                  </div>
                  <div style={{fontSize:11,color:'var(--accent-2)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',marginTop:3}}>{p.category}</div>
                  {!open && <p style={{fontSize:13,color:'var(--text-dim)',margin:'8px 0 0',lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{p.purpose}</p>}
                </div>
                <ArrowRight size={16} color="var(--text-faint)" style={{transform:open?'rotate(90deg)':'rotate(0)',transition:'transform 0.2s',flexShrink:0,marginTop:4}}/>
              </div>
              {open && (
                <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid var(--border)',fontSize:13,color:'var(--text-2)'}}>
                  <p style={{margin:'0 0 12px',lineHeight:1.5}}>{p.purpose}</p>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                    <Info2 label="Dose" val={p.protocol.doseRange}/>
                    <Info2 label="Route" val={p.protocol.route}/>
                    <Info2 label="Timing" val={p.protocol.timing}/>
                    <Info2 label="Cycle" val={p.protocol.cycle}/>
                  </div>
                  <Section3 label="Benefits" items={p.benefits} color="var(--success)"/>
                  {p.synergy.length > 0 && <Section3 label="Synergy" items={p.synergy} color="var(--accent-2)"/>}
                  {p.avoid.length > 0 && <Section3 label="Avoid" items={p.avoid} color="var(--warn)"/>}
                  {p.contraindications.length > 0 && <Section3 label="Contraindications" items={p.contraindications} color="var(--danger)"/>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function Info2({ label, val }) { return <div style={{background:'rgba(0,0,0,0.25)',padding:10,borderRadius:10,border:'1px solid var(--border)'}}><div style={{fontSize:9,color:'var(--text-faint)',textTransform:'uppercase',fontWeight:700,letterSpacing:'0.06em'}}>{label}</div><div style={{fontSize:12,marginTop:3,color:'var(--text)'}}>{val}</div></div>; }
function Section3({ label, items, color }) { return <div style={{marginTop:12}}><div style={{fontSize:11,color,textTransform:'uppercase',fontWeight:700,letterSpacing:'0.06em',marginBottom:6}}>{label}</div><ul style={{margin:0,padding:0,listStyle:'none',display:'flex',flexDirection:'column',gap:4}}>{items.map((s,i) => <li key={i} style={{fontSize:12,color:'var(--text-2)',paddingLeft:14,position:'relative'}}><span style={{position:'absolute',left:0,color}}>•</span>{s}</li>)}</ul></div>; }

function MathView() {
  const [mg, setMg] = useState(5);
  const [ml, setMl] = useState(2);
  const [dose, setDose] = useState(200);
  const [preset, setPreset] = useState('');
  const [components, setComponents] = useState([]);
  
  const apply = (id) => {
    const p = findPep(id);
    if (!p) { setComponents([]); setPreset(''); return; }
    const totalMg = p.reconstitution.typicalVialMg || 5;
    setMg(totalMg);
    setMl(p.reconstitution.defaultDiluentMl || 2);
    setDose(p.protocol.defaultDoseMcg || 200);
    setPreset(id);
    if (p.ingredients && Object.keys(p.ingredients).length > 0) {
      const comps = Object.entries(p.ingredients).map(([cid, frac]) => ({
        id: cid,
        name: findPep(cid)?.name || cid,
        icon: findPep(cid)?.icon || '💊',
        mg: parseFloat((totalMg * frac).toFixed(2))
      }));
      setComponents(comps);
    } else {
      setComponents([]);
    }
  };
  
  const updateComp = (i, newMg) => {
    const next = [...components];
    next[i] = {...next[i], mg: parseFloat(newMg) || 0};
    setComponents(next);
    const total = next.reduce((s, c) => s + c.mg, 0);
    setMg(total);
  };
  
  const totalMg = components.length ? components.reduce((s,c) => s + c.mg, 0) : parseFloat(mg) || 0;
  const math = vialMath(totalMg, parseFloat(ml), parseFloat(dose));
  const fillPct = math ? Math.min(100, math.unitsPerDose) : 0;
  const mlPerDose = math ? math.volPerDose : 0;
  
  return (
    <div style={{paddingBottom:40,paddingTop:8}}>
      <div className="card" style={{padding:18}}>
        <h3 style={{margin:'0 0 6px',fontSize:18,fontWeight:700}}>Reconstitution Math</h3>
        <p style={{margin:'0 0 16px',fontSize:13,color:'var(--text-dim)'}}>U-100 syringe calculator with blend support</p>
        <Field label="Compound"><select value={preset} onChange={e => apply(e.target.value)} className="input"><option value="">— Pick a peptide —</option>{CATEGORIES.map(c => <optgroup key={c} label={c}>{PEPTIDE_DB.filter(p => p.category === c && p.reconstitution.typicalVialMg > 0).map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}</optgroup>)}</select></Field>
        
        {components.length > 0 && (
          <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid var(--border)',padding:12,borderRadius:14,marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>🧪 Blend Components</div>
            {components.map((c, i) => {
              const compMcgPerMl = (c.mg * 1000) / parseFloat(ml || 1);
              const compMcgPerUnit = compMcgPerMl / 100;
              const dosePerUnit = compMcgPerUnit;
              const doseInBlendShot = mlPerDose * compMcgPerMl;
              return (
                <div key={c.id} style={{marginBottom:10,padding:10,background:'rgba(0,0,0,0.25)',borderRadius:10,border:'1px solid var(--border)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                    <span style={{fontSize:18}}>{c.icon}</span>
                    <span style={{flex:1,fontSize:13,fontWeight:600}}>{c.name}</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,alignItems:'center'}}>
                    <div>
                      <label style={{fontSize:9,color:'var(--text-faint)',textTransform:'uppercase',fontWeight:700,letterSpacing:'0.04em'}}>mg in vial</label>
                      <input type="number" step="0.1" value={c.mg} onChange={e => updateComp(i, e.target.value)} className="input" style={{padding:'8px 10px',fontSize:13,fontFamily:'SF Mono, monospace',fontWeight:700}}/>
                    </div>
                    <div style={{fontSize:11,color:'var(--text-dim)',lineHeight:1.4}}>
                      <div>{compMcgPerUnit.toFixed(1)} <span style={{color:'var(--text-faint)'}}>mcg/unit</span></div>
                      <div>{doseInBlendShot.toFixed(0)} <span style={{color:'var(--text-faint)'}}>mcg per shot</span></div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{textAlign:'center',fontSize:12,color:'var(--text-dim)',marginTop:6,paddingTop:8,borderTop:'1px solid var(--border-light)'}}>Total: <b style={{color:'var(--text)'}}>{totalMg.toFixed(2)} mg</b> in {ml} mL</div>
          </div>
        )}
        
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
          {components.length === 0 && <Field label="Vial (mg)"><input type="number" step="0.1" value={mg} onChange={e => setMg(e.target.value)} className="input" style={{textAlign:'center',fontFamily:'SF Mono, monospace',fontWeight:700}}/></Field>}
          {components.length > 0 && <div><label style={{fontSize:12,color:'var(--text-dim)',fontWeight:600,display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em'}}>Total mg</label><div className="input" style={{textAlign:'center',fontFamily:'SF Mono, monospace',fontWeight:700,background:'rgba(255,255,255,0.04)',color:'var(--text-dim)'}}>{totalMg.toFixed(2)}</div></div>}
          <Field label="BAC (mL)"><input type="number" step="0.1" value={ml} onChange={e => setMl(e.target.value)} className="input" style={{textAlign:'center',fontFamily:'SF Mono, monospace',fontWeight:700}}/></Field>
        </div>
        <Field label="Dose (mcg of total blend)"><input type="number" value={dose} onChange={e => setDose(e.target.value)} className="input" style={{textAlign:'center',fontFamily:'SF Mono, monospace',fontWeight:700}}/></Field>
        
        {math && (
          <div className="lg" style={{borderRadius:20, padding:'18px 18px 16px', marginTop:14}}>
            <div style={{display:'flex', alignItems:'baseline', gap:8}}>
              <span style={{fontFamily:'var(--mono)', fontSize:40, fontWeight:700, color:'var(--accent)', lineHeight:1}}>{math.unitsPerDose.toFixed(1)}</span>
              <span style={{fontSize:16, fontWeight:600, color:'var(--text-dim)'}}>units</span>
              <span style={{marginLeft:'auto', fontFamily:'var(--mono)', fontSize:13, color:'var(--text)'}}>{dose} mcg</span>
            </div>
            <div style={{fontSize:12, color:'var(--text-dim)', margin:'8px 0 16px'}}>on a U-100 insulin syringe</div>
            <Syringe units={math.unitsPerDose} color="var(--accent)"/>
            <div style={{display:'flex', justifyContent:'space-between', marginTop:12}}>
              {[['Concentration', (math.mcgPerMl/1000).toFixed(2)+' mg/mL'],['Volume', mlPerDose.toFixed(3)+' mL'],['Doses / vial', '~'+math.totalDoses]].map(([k,v]) => (
                <div key={k} style={{textAlign:'center'}}>
                  <div style={{fontFamily:'var(--mono)', fontSize:15, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap'}}>{v}</div>
                  <div style={{fontSize:9.5, color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:3}}>{k}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const _root = ReactDOM.createRoot(document.getElementById('root'));
_root.render(<App/>);

