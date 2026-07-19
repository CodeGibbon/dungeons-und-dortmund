import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, collection, addDoc, doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, runTransaction,
  enableIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

try { enableIndexedDbPersistence(db); } catch (e) { /* mehrere Tabs offen - ignorieren */ }

const NAME_KEY = 'dundo_name';

const SKILL_DEFS = [
  { key: 'arcana', label: 'Arcana', attr: 'INT' },
  { key: 'examination', label: 'Examination', attr: 'INT' },
  { key: 'finesse', label: 'Finesse', attr: 'DEX' },
  { key: 'influence', label: 'Influence', attr: 'WIL' },
  { key: 'insight', label: 'Insight', attr: 'WIL' },
  { key: 'lore', label: 'Lore', attr: 'INT' },
  { key: 'might', label: 'Might', attr: 'STR' },
  { key: 'naturecraft', label: 'Naturecraft', attr: 'WIL' },
  { key: 'perception', label: 'Perception', attr: 'WIL' },
  { key: 'stealth', label: 'Stealth', attr: 'DEX' }
];

const SKILL_LABELS = Object.fromEntries(SKILL_DEFS.map(s => [s.key, s.label]));
const ATTR_LABEL_TO_KEY = { STR: 'str', DEX: 'dex', INT: 'int', WIL: 'wil' };
const DICE_TYPES = ['w4', 'w6', 'w8', 'w10', 'w12', 'w20', 'w100'];

function defaultSkills() {
  const o = {};
  SKILL_DEFS.forEach(s => { o[s.key] = { bonus: 0 }; });
  return o;
}

function defaultCharacter(name, ancestry, className) {
  return {
    name,
    ancestry: ancestry || '',
    className: className || '',
    level: 1,
    attributes: { str: 0, dex: 0, int: 0, wil: 0 },
    hp: { current: 10, max: 10, temp: 0 },
    armor: { attrKey: 'dex', manual: 0 },
    initiative: 0,
    size: '',
    speed: '',
    weight: '',
    wounds: { max: 5, current: 0 },
    skills: defaultSkills(),
    abilities: [],
    combatSkills: [],
    attackBonusDice: [],
    currency: { copper: 0, silver: 0, gold: 0, platinum: 0 },
    weapons: [],
    armorPieces: [],
    items: [],
    questLog: [],
    createdBy: me,
    createdAt: serverTimestamp()
  };
}

function generateId() {
  return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
}

let me = localStorage.getItem(NAME_KEY) || '';
let storylineEntries = [];
let characters = [];
let activeSection = 'storyline';
let currentCharacterId = null;
let sheetMode = 'normal';
let editingWeaponId = null;
let editingArmorPieceId = null;
let editingItemId = null;
let editingAbilityId = null;
let editingCombatSkillId = null;
let giveContext = null;
let weaponDiceDraft = [];
let combatSkillDiceDraft = [];
let abilityEffectsDraft = [];

const el = (sel) => document.querySelector(sel);

/* ---------- Referenzen ---------- */

const onboarding = el('#onboarding');
const onboardingNameInput = el('#onboardingNameInput');
const onboardingSubmit = el('#onboardingSubmit');
const identityBtn = el('#identityBtn');
const identityLabel = el('#identityLabel');
const identityAvatar = el('#identityAvatar');

const sectionStoryline = el('#sectionStoryline');
const sectionCharacters = el('#sectionCharacters');
const storylineSection = el('#storylineSection');
const charactersSection = el('#charactersSection');

const storylineEmpty = el('#storylineEmpty');
const storylineList = el('#storylineList');

const charListView = el('#charListView');
const charListEmpty = el('#charListEmpty');
const charList = el('#charList');
const characterDetail = el('#characterDetail');
const backToList = el('#backToList');

const modeNormalBtn = el('#modeNormalBtn');
const modeCombatBtn = el('#modeCombatBtn');
const normalModeView = el('#normalModeView');
const combatModeView = el('#combatModeView');

const weaponsListView = el('#weaponsListView');
const armorListView = el('#armorListView');
const itemsListView = el('#itemsListView');
const backToSheetFromWeapons = el('#backToSheetFromWeapons');
const backToSheetFromArmor = el('#backToSheetFromArmor');
const backToSheetFromItems = el('#backToSheetFromItems');
const openWeaponsListBtn = el('#openWeaponsListBtn');
const openArmorListBtn = el('#openArmorListBtn');
const openItemsListBtn = el('#openItemsListBtn');

const fab = el('#fab');
const modalBackdrop = el('#modalBackdrop');

const storylineModal = el('#storylineModal');
const storylineInput = el('#storylineInput');
const storylineAddBtn = el('#storylineAddBtn');
const storylineCancelBtn = el('#storylineCancelBtn');

const newCharacterModal = el('#newCharacterModal');
const newCharName = el('#newCharName');
const newCharAncestry = el('#newCharAncestry');
const newCharClass = el('#newCharClass');
const newCharAddBtn = el('#newCharAddBtn');
const newCharCancelBtn = el('#newCharCancelBtn');

// Normal-Modus
const chName = el('#chName');
const chAncestry = el('#chAncestry');
const chClass = el('#chClass');
const levelValue = el('#levelValue');
const levelUp = el('#levelUp');
const levelDown = el('#levelDown');
const statStr = el('#statStr');
const statDex = el('#statDex');
const statInt = el('#statInt');
const statWil = el('#statWil');
const hpCurrent = el('#hpCurrent');
const hpMax = el('#hpMax');
const hpTemp = el('#hpTemp');
const initiative = el('#initiative');
const chSize = el('#chSize');
const chSpeed = el('#chSpeed');
const chWeight = el('#chWeight');
const woundsMax = el('#woundsMax');
const woundsPips = el('#woundsPips');
const skillsGrid = el('#skillsGrid');
const abilitiesEmpty = el('#abilitiesEmpty');
const abilitiesList = el('#abilitiesList');
const addAbilityBtn = el('#addAbilityBtn');
const curCopper = el('#curCopper');
const curSilver = el('#curSilver');
const curGold = el('#curGold');
const curPlatinum = el('#curPlatinum');
const equippedWeaponsEmpty = el('#equippedWeaponsEmpty');
const equippedWeaponsSummary = el('#equippedWeaponsSummary');
const equippedArmorEmpty = el('#equippedArmorEmpty');
const equippedArmorSummary = el('#equippedArmorSummary');
const questLogInput = el('#questLogInput');
const addQuestLogBtn = el('#addQuestLogBtn');
const questLogEmpty = el('#questLogEmpty');
const questLogList = el('#questLogList');
const deleteCharacterBtn = el('#deleteCharacterBtn');

// Kampf-Modus
const combatName = el('#combatName');
const combatHpCurrent = el('#combatHpCurrent');
const combatHpMax = el('#combatHpMax');
const combatSpeed = el('#combatSpeed');
const combatInitiative = el('#combatInitiative');
const combatStr = el('#combatStr');
const combatDex = el('#combatDex');
const combatInt = el('#combatInt');
const combatWil = el('#combatWil');
const combatSkillsOverview = el('#combatSkillsOverview');
const armorGearSumEl = el('#armorGearSum');
const armorAttrSelect = el('#armorAttrSelect');
const armorAttrValue = el('#armorAttrValue');
const armorManual = el('#armorManual');
const armorTotalEl = el('#armorTotal');
const attackWeaponsEmpty = el('#attackWeaponsEmpty');
const attackWeaponsList = el('#attackWeaponsList');
const addAttackBonusDieBtn = el('#addAttackBonusDieBtn');
const attackBonusRows = el('#attackBonusRows');
const addCombatSkillBtn = el('#addCombatSkillBtn');
const combatSkillsEmpty = el('#combatSkillsEmpty');
const combatSkillsList = el('#combatSkillsList');
const attackTotal = el('#attackTotal');

// Listen
const weaponsList = el('#weaponsList');
const weaponsEmpty = el('#weaponsEmpty');
const addWeaponBtn = el('#addWeaponBtn');
const armorPiecesList = el('#armorPiecesList');
const armorPiecesEmpty = el('#armorPiecesEmpty');
const addArmorPieceBtn = el('#addArmorPieceBtn');
const itemsList = el('#itemsList');
const itemsEmpty = el('#itemsEmpty');
const addItemBtn = el('#addItemBtn');

// Modals
const weaponModal = el('#weaponModal');
const weaponModalTitle = el('#weaponModalTitle');
const weaponName = el('#weaponName');
const weaponHandedness = el('#weaponHandedness');
const weaponRange = el('#weaponRange');
const weaponMagical = el('#weaponMagical');
const weaponDiceRows = el('#weaponDiceRows');
const addDiceRowBtn = el('#addDiceRowBtn');
const weaponDescription = el('#weaponDescription');
const weaponSaveBtn = el('#weaponSaveBtn');
const weaponCancelBtn = el('#weaponCancelBtn');
const weaponDeleteBtn = el('#weaponDeleteBtn');

const armorPieceModal = el('#armorPieceModal');
const armorPieceModalTitle = el('#armorPieceModalTitle');
const armorPieceName = el('#armorPieceName');
const armorPieceWeightClass = el('#armorPieceWeightClass');
const armorPieceValue = el('#armorPieceValue');
const armorPieceScalesWith = el('#armorPieceScalesWith');
const armorPieceDescription = el('#armorPieceDescription');
const armorPieceSaveBtn = el('#armorPieceSaveBtn');
const armorPieceCancelBtn = el('#armorPieceCancelBtn');
const armorPieceDeleteBtn = el('#armorPieceDeleteBtn');

const itemModal = el('#itemModal');
const itemModalTitle = el('#itemModalTitle');
const itemName = el('#itemName');
const itemQty = el('#itemQty');
const itemEffect = el('#itemEffect');
const itemSaveBtn = el('#itemSaveBtn');
const itemCancelBtn = el('#itemCancelBtn');
const itemDeleteBtn = el('#itemDeleteBtn');

const abilityModal = el('#abilityModal');
const abilityModalTitle = el('#abilityModalTitle');
const abilityName = el('#abilityName');
const abilityEffectRows = el('#abilityEffectRows');
const addAbilityEffectBtn = el('#addAbilityEffectBtn');
const abilityDescription = el('#abilityDescription');
const abilitySaveBtn = el('#abilitySaveBtn');
const abilityCancelBtn = el('#abilityCancelBtn');
const abilityDeleteBtn = el('#abilityDeleteBtn');

const combatSkillModal = el('#combatSkillModal');
const combatSkillModalTitle = el('#combatSkillModalTitle');
const combatSkillName = el('#combatSkillName');
const combatSkillDiceRows = el('#combatSkillDiceRows');
const addCombatSkillDiceBtn = el('#addCombatSkillDiceBtn');
const combatSkillDescription = el('#combatSkillDescription');
const combatSkillSaveBtn = el('#combatSkillSaveBtn');
const combatSkillCancelBtn = el('#combatSkillCancelBtn');
const combatSkillDeleteBtn = el('#combatSkillDeleteBtn');

const giveModal = el('#giveModal');
const giveModalTitle = el('#giveModalTitle');
const giveTargetSelect = el('#giveTargetSelect');
const giveQtyRow = el('#giveQtyRow');
const giveQty = el('#giveQty');
const giveConfirmBtn = el('#giveConfirmBtn');
const giveCancelBtn = el('#giveCancelBtn');

function initials(name) {
  return (name || '?').trim().slice(0, 1).toUpperCase();
}

function formatDateTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function getCurrentCharacter() {
  return characters.find(c => c.id === currentCharacterId) || null;
}

function charRef(id) {
  return doc(db, 'characters', id);
}

function attrValue(c, key) {
  return c.attributes?.[key] ?? 0;
}

/* Fähigkeiten: alte Einträge hatten skillKey/value, neue haben effects: [{skillKey, value}] */
function abilityEffects(ab) {
  if (Array.isArray(ab.effects)) return ab.effects;
  if (ab.skillKey) return [{ skillKey: ab.skillKey, value: Number(ab.value) || 0 }];
  return [];
}

function abilitiesSumForSkill(c, skillKey) {
  return (c.abilities || [])
    .filter(a => a.active)
    .reduce((sum, a) => sum + abilityEffects(a)
      .filter(e => e.skillKey === skillKey)
      .reduce((s, e) => s + (Number(e.value) || 0), 0), 0);
}

function skillTotal(c, def) {
  const base = attrValue(c, ATTR_LABEL_TO_KEY[def.attr]);
  const abil = abilitiesSumForSkill(c, def.key);
  const bonus = Number(c.skills?.[def.key]?.bonus) || 0;
  return { base, abil, bonus, total: base + abil + bonus };
}

function armorGearSumCalc(c) {
  return (c.armorPieces || []).filter(a => a.equipped).reduce((sum, a) => sum + (Number(a.armorValue) || 0), 0);
}

function equippedWeapons(c) {
  return (c.weapons || []).filter(w => w.equipped);
}

function equippedArmorPieces(c) {
  return (c.armorPieces || []).filter(a => a.equipped);
}

function fmtSigned(v) {
  return (v >= 0 ? '+' : '') + v;
}

/* ---------- Onboarding / Identität ---------- */

function showOnboardingIfNeeded() {
  if (!me) {
    onboarding.classList.add('show');
  } else {
    updateIdentityChip();
  }
}

function updateIdentityChip() {
  identityLabel.textContent = me;
  identityAvatar.textContent = initials(me);
}

onboardingNameInput.addEventListener('input', () => {
  onboardingSubmit.disabled = onboardingNameInput.value.trim().length === 0;
});

onboardingNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !onboardingSubmit.disabled) onboardingSubmit.click();
});

onboardingSubmit.addEventListener('click', () => {
  const name = onboardingNameInput.value.trim();
  if (!name) return;
  me = name;
  localStorage.setItem(NAME_KEY, me);
  onboarding.classList.remove('show');
  updateIdentityChip();
});

identityBtn.addEventListener('click', () => {
  onboardingNameInput.value = me;
  onboardingSubmit.disabled = me.trim().length === 0;
  onboarding.classList.add('show');
  setTimeout(() => onboardingNameInput.focus(), 50);
});

/* ---------- Navigation ---------- */

sectionStoryline.addEventListener('click', () => setSection('storyline'));
sectionCharacters.addEventListener('click', () => setSection('characters'));

function setSection(section) {
  activeSection = section;
  sectionStoryline.classList.toggle('active', section === 'storyline');
  sectionCharacters.classList.toggle('active', section === 'characters');
  storylineSection.classList.toggle('hidden', section !== 'storyline');
  charactersSection.classList.toggle('hidden', section !== 'characters');
  if (section === 'characters') {
    if (!currentCharacterId) showCharList();
  }
  updateFabVisibility();
}

function updateFabVisibility() {
  if (activeSection === 'storyline') {
    fab.classList.remove('hidden');
    fab.setAttribute('aria-label', 'Neuer Storyline-Eintrag');
  } else if (activeSection === 'characters' && !currentCharacterId) {
    fab.classList.remove('hidden');
    fab.setAttribute('aria-label', 'Neuer Charakter');
  } else {
    fab.classList.add('hidden');
  }
}

fab.addEventListener('click', () => {
  if (activeSection === 'storyline') openStorylineModal();
  else openNewCharacterModal();
});

modalBackdrop.addEventListener('click', () => {
  closeStorylineModal();
  closeNewCharacterModal();
  closeWeaponModal();
  closeArmorPieceModal();
  closeItemModal();
  closeAbilityModal();
  closeCombatSkillModal();
  closeGiveModal();
});

/* ---------- Modus-Umschalter ---------- */

modeNormalBtn.addEventListener('click', () => setSheetMode('normal'));
modeCombatBtn.addEventListener('click', () => setSheetMode('combat'));

function setSheetMode(mode) {
  sheetMode = mode;
  modeNormalBtn.classList.toggle('active', mode === 'normal');
  modeCombatBtn.classList.toggle('active', mode === 'combat');
  normalModeView.classList.toggle('hidden', mode !== 'normal');
  combatModeView.classList.toggle('hidden', mode !== 'combat');
  const c = getCurrentCharacter();
  if (c) renderCharacterSheet();
}

/* ---------- Storyline ---------- */

function openStorylineModal() {
  storylineInput.value = '';
  storylineAddBtn.disabled = true;
  storylineModal.classList.add('show');
  modalBackdrop.classList.add('show');
  setTimeout(() => storylineInput.focus(), 50);
}

function closeStorylineModal() {
  storylineModal.classList.remove('show');
  modalBackdrop.classList.remove('show');
}

storylineInput.addEventListener('input', () => {
  storylineAddBtn.disabled = storylineInput.value.trim().length === 0;
});

storylineCancelBtn.addEventListener('click', closeStorylineModal);

storylineAddBtn.addEventListener('click', () => {
  const text = storylineInput.value.trim();
  if (!text) return;
  addDoc(collection(db, 'storyline'), {
    text,
    author: me,
    createdAt: serverTimestamp()
  });
  closeStorylineModal();
});

async function removeStorylineEntry(entry) {
  if (!window.confirm('Diesen Eintrag wirklich löschen?')) return;
  await deleteDoc(doc(db, 'storyline', entry.id));
}

function renderStoryline() {
  storylineList.innerHTML = '';
  storylineEmpty.style.display = storylineEntries.length ? 'none' : 'block';
  storylineEmpty.textContent = 'Noch keine Einträge. Schreib rein, was letzte Session passiert ist!';

  storylineEntries.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'storyline-entry';

    const text = document.createElement('div');
    text.className = 'storyline-text';
    text.textContent = entry.text;
    row.appendChild(text);

    const meta = document.createElement('div');
    meta.className = 'storyline-meta';
    const metaText = document.createElement('span');
    metaText.textContent = `${entry.author || '?'} · ${formatDateTime(entry.createdAt)}`;
    meta.appendChild(metaText);

    if (entry.author === me) {
      const del = document.createElement('button');
      del.className = 'delete-btn';
      del.innerHTML = '&times;';
      del.setAttribute('aria-label', 'Löschen');
      del.addEventListener('click', () => removeStorylineEntry(entry));
      meta.appendChild(del);
    }

    row.appendChild(meta);
    storylineList.appendChild(row);
  });
}

/* ---------- Charakterliste ---------- */

function showCharList() {
  charListView.classList.remove('hidden');
  characterDetail.classList.add('hidden');
  weaponsListView.classList.add('hidden');
  armorListView.classList.add('hidden');
  itemsListView.classList.add('hidden');
  currentCharacterId = null;
  updateFabVisibility();
  renderCharList();
}

function showCharacterDetail(id) {
  currentCharacterId = id;
  charListView.classList.add('hidden');
  weaponsListView.classList.add('hidden');
  armorListView.classList.add('hidden');
  itemsListView.classList.add('hidden');
  characterDetail.classList.remove('hidden');
  setSheetMode('normal');
  updateFabVisibility();
  renderCharacterSheet();
}

backToList.addEventListener('click', showCharList);

openWeaponsListBtn.addEventListener('click', () => {
  characterDetail.classList.add('hidden');
  weaponsListView.classList.remove('hidden');
  renderWeaponsList(getCurrentCharacter());
});
backToSheetFromWeapons.addEventListener('click', () => {
  weaponsListView.classList.add('hidden');
  characterDetail.classList.remove('hidden');
});

openArmorListBtn.addEventListener('click', () => {
  characterDetail.classList.add('hidden');
  armorListView.classList.remove('hidden');
  renderArmorPiecesList(getCurrentCharacter());
});
backToSheetFromArmor.addEventListener('click', () => {
  armorListView.classList.add('hidden');
  characterDetail.classList.remove('hidden');
});

openItemsListBtn.addEventListener('click', () => {
  characterDetail.classList.add('hidden');
  itemsListView.classList.remove('hidden');
  renderItemsList(getCurrentCharacter());
});
backToSheetFromItems.addEventListener('click', () => {
  itemsListView.classList.add('hidden');
  characterDetail.classList.remove('hidden');
});

function currencyLabel(c) {
  const parts = [];
  if (c.platinum) parts.push(`${c.platinum}P`);
  if (c.gold) parts.push(`${c.gold}G`);
  if (c.silver) parts.push(`${c.silver}S`);
  if (c.copper) parts.push(`${c.copper}K`);
  return parts.length ? parts.join(' ') : '0G';
}

function renderCharList() {
  charList.innerHTML = '';
  charListEmpty.style.display = characters.length ? 'none' : 'block';
  charListEmpty.textContent = 'Noch keine Charaktere. Leg den ersten an!';

  characters.forEach(c => {
    const card = document.createElement('div');
    card.className = 'char-card';
    card.addEventListener('click', () => showCharacterDetail(c.id));

    const avatar = document.createElement('div');
    avatar.className = 'char-card-avatar';
    avatar.textContent = initials(c.name);
    card.appendChild(avatar);

    const info = document.createElement('div');
    info.className = 'char-card-info';

    const name = document.createElement('div');
    name.className = 'char-card-name';
    name.textContent = c.name || '(unbenannt)';
    info.appendChild(name);

    const sub = document.createElement('div');
    sub.className = 'char-card-sub';
    const parts = [];
    if (c.className) parts.push(c.className);
    if (c.ancestry) parts.push(c.ancestry);
    parts.push(`Lvl ${c.level || 1}`);
    parts.push(`${c.hp?.current ?? 0}/${c.hp?.max ?? 0} HP`);
    sub.textContent = parts.join(' · ');
    info.appendChild(sub);

    const hpBar = document.createElement('div');
    hpBar.className = 'char-card-hp';
    const hpFill = document.createElement('div');
    hpFill.className = 'char-card-hp-fill';
    const max = c.hp?.max || 1;
    const cur = Math.max(0, c.hp?.current ?? 0);
    hpFill.style.width = `${Math.min(100, (cur / max) * 100)}%`;
    hpBar.appendChild(hpFill);
    info.appendChild(hpBar);

    card.appendChild(info);

    const gold = document.createElement('div');
    gold.className = 'char-card-gold';
    gold.textContent = currencyLabel(c.currency || {});
    card.appendChild(gold);

    charList.appendChild(card);
  });
}

/* ---------- Neuer Charakter ---------- */

function openNewCharacterModal() {
  newCharName.value = '';
  newCharAncestry.value = '';
  newCharClass.value = '';
  newCharAddBtn.disabled = true;
  newCharacterModal.classList.add('show');
  modalBackdrop.classList.add('show');
  setTimeout(() => newCharName.focus(), 50);
}

function closeNewCharacterModal() {
  newCharacterModal.classList.remove('show');
  modalBackdrop.classList.remove('show');
}

newCharName.addEventListener('input', () => {
  newCharAddBtn.disabled = newCharName.value.trim().length === 0;
});

newCharCancelBtn.addEventListener('click', closeNewCharacterModal);

newCharAddBtn.addEventListener('click', () => {
  const name = newCharName.value.trim();
  if (!name) return;
  const ref = doc(collection(db, 'characters'));
  setDoc(ref, defaultCharacter(
    name, newCharAncestry.value.trim(), newCharClass.value.trim()
  ));
  closeNewCharacterModal();
  showCharacterDetail(ref.id);
});

deleteCharacterBtn.addEventListener('click', () => {
  const c = getCurrentCharacter();
  if (!c) return;
  if (!window.confirm(`"${c.name}" wirklich unwiderruflich löschen?`)) return;
  deleteDoc(charRef(c.id));
  showCharList();
});

/* ---------- Sheet: einfache Felder ---------- */

function bindField(inputEl, path, transform) {
  inputEl.addEventListener('change', () => {
    if (!currentCharacterId) return;
    let val = inputEl.value;
    if (transform) val = transform(val);
    updateDoc(charRef(currentCharacterId), { [path]: val });
  });
}

const asNumber = (v) => Number(v) || 0;
const asText = (v) => v.trim();

bindField(chName, 'name', asText);
bindField(chAncestry, 'ancestry', asText);
bindField(chClass, 'className', asText);
bindField(statStr, 'attributes.str', asNumber);
bindField(statDex, 'attributes.dex', asNumber);
bindField(statInt, 'attributes.int', asNumber);
bindField(statWil, 'attributes.wil', asNumber);
bindField(hpCurrent, 'hp.current', asNumber);
bindField(hpMax, 'hp.max', asNumber);
bindField(hpTemp, 'hp.temp', asNumber);
bindField(initiative, 'initiative', asNumber);
bindField(chSize, 'size', asText);
bindField(chSpeed, 'speed', asText);
bindField(chWeight, 'weight', asText);
bindField(curCopper, 'currency.copper', asNumber);
bindField(curSilver, 'currency.silver', asNumber);
bindField(curGold, 'currency.gold', asNumber);
bindField(curPlatinum, 'currency.platinum', asNumber);
bindField(armorManual, 'armor.manual', asNumber);
bindField(combatHpCurrent, 'hp.current', asNumber);

bindField(woundsMax, 'wounds.max', (v) => Math.max(1, Number(v) || 1));

armorAttrSelect.addEventListener('change', () => {
  if (!currentCharacterId) return;
  updateDoc(charRef(currentCharacterId), { 'armor.attrKey': armorAttrSelect.value });
});

levelUp.addEventListener('click', () => {
  const c = getCurrentCharacter();
  if (!c) return;
  updateDoc(charRef(c.id), { level: Math.min(20, (c.level || 1) + 1) });
});

levelDown.addEventListener('click', () => {
  const c = getCurrentCharacter();
  if (!c) return;
  updateDoc(charRef(c.id), { level: Math.max(1, (c.level || 1) - 1) });
});

/* ---------- Wounds ---------- */

function renderWoundsPips(c) {
  woundsPips.innerHTML = '';
  const max = c.wounds?.max || 5;
  const current = c.wounds?.current || 0;
  for (let i = 0; i < max; i++) {
    const pip = document.createElement('button');
    pip.type = 'button';
    pip.className = 'wound-pip' + (i < current ? ' filled' : '') + (i === max - 1 ? ' skull' : '');
    pip.textContent = i === max - 1 ? '💀' : '';
    pip.addEventListener('click', () => {
      const level = i + 1;
      const newCurrent = (current === level) ? level - 1 : level;
      updateDoc(charRef(c.id), { 'wounds.current': newCurrent });
    });
    woundsPips.appendChild(pip);
  }
}

/* ---------- Armor-Komposition (Kampf-Modus) ---------- */

function renderArmorComposite(c) {
  const gearSum = armorGearSumCalc(c);
  armorGearSumEl.textContent = gearSum;

  const attrKey = c.armor?.attrKey || 'dex';
  if (document.activeElement !== armorAttrSelect) armorAttrSelect.value = attrKey;
  const attrVal = attrValue(c, attrKey);
  armorAttrValue.textContent = `${attrKey.toUpperCase()}: ${attrVal}`;

  if (document.activeElement !== armorManual) armorManual.value = c.armor?.manual ?? 0;
  const manual = c.armor?.manual ?? 0;

  armorTotalEl.textContent = gearSum + attrVal + manual;
}

/* ---------- Würfel-Helfer ---------- */

function aggregateDiceEntries(entryLists) {
  const map = new Map();
  entryLists.forEach(entries => {
    (entries || []).forEach(e => {
      const key = `${e.dieType}|${e.damageType}|${e.magicElement || ''}`;
      map.set(key, (map.get(key) || 0) + (Number(e.count) || 0));
    });
  });
  return [...map.entries()].map(([key, count]) => {
    const [dieType, damageType, magicElement] = key.split('|');
    return { dieType, damageType, magicElement, count };
  });
}

function diceEntryLabel(e) {
  const typeLabel = e.damageType === 'magisch' ? `Magisch${e.magicElement ? ': ' + e.magicElement : ''}` : 'Physisch';
  return `${e.count}×${(e.dieType || '').toUpperCase()} (${typeLabel})`;
}

function diceListLabel(entries) {
  return (entries || []).map(diceEntryLabel).join(', ');
}

/* Generische Würfel-Zeile: draft-Array wird direkt mutiert, onStructureChange rendert neu */
function buildDiceRow(draft, index, onStructureChange) {
  const entry = draft[index];
  const row = document.createElement('div');
  row.className = 'dice-row';

  const dieSelect = document.createElement('select');
  DICE_TYPES.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t.toUpperCase();
    if (t === entry.dieType) opt.selected = true;
    dieSelect.appendChild(opt);
  });
  dieSelect.addEventListener('change', () => { entry.dieType = dieSelect.value; onStructureChange(false); });
  row.appendChild(dieSelect);

  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.min = '1';
  countInput.value = entry.count ?? 1;
  countInput.addEventListener('change', () => {
    entry.count = Math.max(1, parseInt(countInput.value, 10) || 1);
    onStructureChange(false);
  });
  row.appendChild(countInput);

  const typeSelect = document.createElement('select');
  [['physisch', 'Physisch'], ['magisch', 'Magisch']].forEach(([v, l]) => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = l;
    if (v === entry.damageType) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  typeSelect.addEventListener('change', () => {
    entry.damageType = typeSelect.value;
    onStructureChange(true);
  });
  row.appendChild(typeSelect);

  const elementInput = document.createElement('input');
  elementInput.type = 'text';
  elementInput.placeholder = 'z.B. Feuer, Eis';
  elementInput.value = entry.magicElement || '';
  elementInput.disabled = entry.damageType !== 'magisch';
  elementInput.addEventListener('change', () => {
    entry.magicElement = elementInput.value.trim();
    onStructureChange(false);
  });
  row.appendChild(elementInput);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'dice-row-remove';
  removeBtn.innerHTML = '&times;';
  removeBtn.setAttribute('aria-label', 'Würfel entfernen');
  removeBtn.addEventListener('click', () => {
    draft.splice(index, 1);
    onStructureChange(true);
  });
  row.appendChild(removeBtn);

  return row;
}

function renderDraftDiceRows(container, draft) {
  container.innerHTML = '';
  draft.forEach((_, i) => container.appendChild(buildDiceRow(draft, i, (rerender) => {
    if (rerender) renderDraftDiceRows(container, draft);
  })));
}

/* ---------- Skills (Normal-Modus) ---------- */

function renderSkillsGrid(c) {
  skillsGrid.innerHTML = '';
  SKILL_DEFS.forEach(def => {
    const { base, abil, bonus, total } = skillTotal(c, def);

    const row = document.createElement('div');
    row.className = 'skill-row';

    const nameCell = document.createElement('div');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'skill-name';
    nameSpan.textContent = def.label;
    const attrSpan = document.createElement('span');
    attrSpan.className = 'skill-attr';
    attrSpan.textContent = def.attr;
    nameCell.appendChild(nameSpan);
    nameCell.appendChild(attrSpan);
    row.appendChild(nameCell);

    const baseCell = document.createElement('div');
    baseCell.className = 'skill-readonly';
    baseCell.textContent = base;
    row.appendChild(baseCell);

    const abilCell = document.createElement('div');
    abilCell.className = 'skill-readonly';
    abilCell.textContent = fmtSigned(abil);
    row.appendChild(abilCell);

    const bonusInput = document.createElement('input');
    bonusInput.type = 'number';
    bonusInput.value = bonus;
    bonusInput.addEventListener('change', () => {
      updateDoc(charRef(c.id), { [`skills.${def.key}.bonus`]: Number(bonusInput.value) || 0 });
    });
    row.appendChild(bonusInput);

    const totalCell = document.createElement('div');
    totalCell.className = 'skill-total';
    totalCell.textContent = fmtSigned(total);
    row.appendChild(totalCell);

    skillsGrid.appendChild(row);
  });
}

/* ---------- Fähigkeiten (eigenes Fenster, Normal-Modus) ---------- */

addAbilityBtn.addEventListener('click', () => openAbilityModal(null));

function abilityEffectsLabel(ab) {
  return abilityEffects(ab)
    .map(e => `${SKILL_LABELS[e.skillKey] || e.skillKey} ${fmtSigned(Number(e.value) || 0)}`)
    .join(' · ');
}

function renderAbilitiesList(c) {
  const abilities = c.abilities || [];
  abilitiesList.innerHTML = '';
  abilitiesEmpty.style.display = abilities.length ? 'none' : 'block';

  abilities.forEach(ab => {
    const row = document.createElement('div');
    row.className = 'item-row' + (ab.active ? ' equipped' : '');

    const top = document.createElement('div');
    top.className = 'item-row-top';

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'equip-checkbox' + (ab.active ? ' checked' : '');
    check.setAttribute('aria-label', ab.active ? 'Deaktivieren' : 'Aktivieren');
    check.addEventListener('click', () => {
      const abilities = (c.abilities || []).map(a => a.id === ab.id ? { ...a, active: !a.active } : a);
      updateDoc(charRef(c.id), { abilities });
    });
    top.appendChild(check);

    const nameWrap = document.createElement('div');
    nameWrap.style.flex = '1';
    const nameEl = document.createElement('div');
    nameEl.className = 'item-row-name';
    nameEl.textContent = ab.name;
    nameWrap.appendChild(nameEl);
    const tags = document.createElement('div');
    tags.className = 'item-row-tags';
    tags.textContent = abilityEffectsLabel(ab) || 'Kein Skill-Effekt';
    nameWrap.appendChild(tags);
    top.appendChild(nameWrap);

    row.appendChild(top);

    if (ab.description) {
      const desc = document.createElement('div');
      desc.className = 'item-row-desc';
      desc.textContent = ab.description;
      row.appendChild(desc);
    }

    const actions = document.createElement('div');
    actions.className = 'item-row-actions';
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Bearbeiten';
    editBtn.addEventListener('click', () => openAbilityModal(ab));
    actions.appendChild(editBtn);
    row.appendChild(actions);

    abilitiesList.appendChild(row);
  });
}

function buildAbilityEffectRow(index) {
  const entry = abilityEffectsDraft[index];
  const row = document.createElement('div');
  row.className = 'dice-row ability-effect-row';

  const skillSelect = document.createElement('select');
  SKILL_DEFS.forEach(def => {
    const opt = document.createElement('option');
    opt.value = def.key;
    opt.textContent = def.label;
    if (def.key === entry.skillKey) opt.selected = true;
    skillSelect.appendChild(opt);
  });
  skillSelect.addEventListener('change', () => { entry.skillKey = skillSelect.value; });
  row.appendChild(skillSelect);

  const valueInput = document.createElement('input');
  valueInput.type = 'number';
  valueInput.value = entry.value ?? 0;
  valueInput.addEventListener('change', () => { entry.value = Number(valueInput.value) || 0; });
  row.appendChild(valueInput);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'dice-row-remove';
  removeBtn.innerHTML = '&times;';
  removeBtn.setAttribute('aria-label', 'Skill-Effekt entfernen');
  removeBtn.addEventListener('click', () => {
    abilityEffectsDraft.splice(index, 1);
    renderAbilityEffectRows();
  });
  row.appendChild(removeBtn);

  return row;
}

function renderAbilityEffectRows() {
  abilityEffectRows.innerHTML = '';
  abilityEffectsDraft.forEach((_, i) => abilityEffectRows.appendChild(buildAbilityEffectRow(i)));
}

addAbilityEffectBtn.addEventListener('click', () => {
  abilityEffectsDraft.push({ skillKey: SKILL_DEFS[0].key, value: 0 });
  renderAbilityEffectRows();
});

function openAbilityModal(ability) {
  editingAbilityId = ability ? ability.id : null;
  abilityModalTitle.textContent = ability ? 'Fähigkeit bearbeiten' : 'Neue Fähigkeit';
  abilityName.value = ability ? ability.name : '';
  abilityDescription.value = ability ? (ability.description || '') : '';
  abilityEffectsDraft = ability ? abilityEffects(ability).map(e => ({ ...e })) : [{ skillKey: SKILL_DEFS[0].key, value: 0 }];
  renderAbilityEffectRows();
  abilityDeleteBtn.classList.toggle('hidden', !ability);
  abilitySaveBtn.disabled = abilityName.value.trim().length === 0;
  abilityModal.classList.add('show');
  modalBackdrop.classList.add('show');
  setTimeout(() => abilityName.focus(), 50);
}

function closeAbilityModal() {
  abilityModal.classList.remove('show');
  modalBackdrop.classList.remove('show');
  editingAbilityId = null;
}

abilityName.addEventListener('input', () => {
  abilitySaveBtn.disabled = abilityName.value.trim().length === 0;
});

abilityCancelBtn.addEventListener('click', closeAbilityModal);

abilitySaveBtn.addEventListener('click', () => {
  const c = getCurrentCharacter();
  if (!c) return;
  const name = abilityName.value.trim();
  if (!name) return;
  const abilities = [...(c.abilities || [])];
  const entry = {
    id: editingAbilityId || generateId(),
    name,
    effects: abilityEffectsDraft.map(e => ({ skillKey: e.skillKey, value: Number(e.value) || 0 })),
    description: abilityDescription.value.trim(),
    active: true
  };
  if (editingAbilityId) {
    const idx = abilities.findIndex(a => a.id === editingAbilityId);
    if (idx !== -1) entry.active = abilities[idx].active;
    if (idx !== -1) abilities[idx] = entry; else abilities.push(entry);
  } else {
    abilities.push(entry);
  }
  updateDoc(charRef(c.id), { abilities });
  closeAbilityModal();
});

abilityDeleteBtn.addEventListener('click', () => {
  const c = getCurrentCharacter();
  if (!c || !editingAbilityId) return;
  if (!window.confirm('Diese Fähigkeit wirklich löschen?')) return;
  const abilities = (c.abilities || []).filter(a => a.id !== editingAbilityId);
  updateDoc(charRef(c.id), { abilities });
  closeAbilityModal();
});

/* ---------- Kampf-Modus: Quicksheet ---------- */

function renderCombatQuick(c) {
  combatName.textContent = c.name || '(unbenannt)';
  if (document.activeElement !== combatHpCurrent) combatHpCurrent.value = c.hp?.current ?? 0;
  combatHpMax.textContent = c.hp?.max ?? 0;
  combatSpeed.textContent = c.speed || '—';
  combatInitiative.textContent = c.initiative ?? 0;
  combatStr.textContent = attrValue(c, 'str');
  combatDex.textContent = attrValue(c, 'dex');
  combatInt.textContent = attrValue(c, 'int');
  combatWil.textContent = attrValue(c, 'wil');

  combatSkillsOverview.innerHTML = '';
  SKILL_DEFS.forEach(def => {
    const { total } = skillTotal(c, def);
    const cell = document.createElement('div');
    cell.className = 'combat-skill-cell';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'combat-skill-name';
    nameSpan.textContent = def.label;
    const valSpan = document.createElement('span');
    valSpan.className = 'combat-skill-value';
    valSpan.textContent = fmtSigned(total);
    cell.appendChild(nameSpan);
    cell.appendChild(valSpan);
    combatSkillsOverview.appendChild(cell);
  });
}

/* ---------- Kampf-Modus: Angriff ---------- */

function renderAttackBonusRows(c) {
  const arr = (c.attackBonusDice || []).map(e => ({ ...e }));
  attackBonusRows.innerHTML = '';
  arr.forEach((_, i) => attackBonusRows.appendChild(buildDiceRow(arr, i, () => {
    updateDoc(charRef(c.id), { attackBonusDice: arr.map(e => ({ ...e })) });
  })));
}

addAttackBonusDieBtn.addEventListener('click', () => {
  const c = getCurrentCharacter();
  if (!c) return;
  const arr = [...(c.attackBonusDice || []), { id: generateId(), dieType: 'w6', count: 1, damageType: 'physisch', magicElement: '' }];
  updateDoc(charRef(c.id), { attackBonusDice: arr });
});

function renderAttack(c) {
  const weapons = equippedWeapons(c);
  attackWeaponsList.innerHTML = '';
  attackWeaponsEmpty.style.display = weapons.length ? 'none' : 'block';

  weapons.forEach((w, i) => {
    const line = document.createElement('div');
    line.className = 'attack-line';
    const label = document.createElement('span');
    label.className = 'attack-line-name';
    label.textContent = `${i + 1}. ${w.name}`;
    const dice = document.createElement('span');
    dice.className = 'attack-line-dice';
    dice.textContent = diceListLabel(w.diceEntries) || 'keine Würfel';
    line.appendChild(label);
    line.appendChild(dice);
    attackWeaponsList.appendChild(line);
  });

  renderAttackBonusRows(c);
  renderCombatSkillsList(c);

  const includedSkillDice = (c.combatSkills || []).filter(s => s.included).map(s => s.diceEntries || []);
  const allLists = [
    ...weapons.map(w => w.diceEntries || []),
    c.attackBonusDice || [],
    ...includedSkillDice
  ];
  const agg = aggregateDiceEntries(allLists);
  attackTotal.textContent = agg.length
    ? 'Gesamtangriff: ' + agg.map(diceEntryLabel).join(' + ')
    : 'Gesamtangriff: — (nichts angelegt/aktiviert)';
}

/* ---------- Kampfskills ---------- */

addCombatSkillBtn.addEventListener('click', () => openCombatSkillModal(null));

function renderCombatSkillsList(c) {
  const skills = c.combatSkills || [];
  combatSkillsList.innerHTML = '';
  combatSkillsEmpty.style.display = skills.length ? 'none' : 'block';

  skills.forEach(cs => {
    const row = document.createElement('div');
    row.className = 'item-row' + (cs.included ? ' equipped' : '');

    const top = document.createElement('div');
    top.className = 'item-row-top';

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'equip-checkbox' + (cs.included ? ' checked' : '');
    check.setAttribute('aria-label', cs.included ? 'Aus Gesamtangriff entfernen' : 'Zum Gesamtangriff hinzufügen');
    check.addEventListener('click', () => {
      const combatSkills = (c.combatSkills || []).map(s => s.id === cs.id ? { ...s, included: !s.included } : s);
      updateDoc(charRef(c.id), { combatSkills });
    });
    top.appendChild(check);

    const nameWrap = document.createElement('div');
    nameWrap.style.flex = '1';
    const nameEl = document.createElement('div');
    nameEl.className = 'item-row-name';
    nameEl.textContent = cs.name;
    nameWrap.appendChild(nameEl);
    const tags = document.createElement('div');
    tags.className = 'item-row-tags';
    tags.textContent = diceListLabel(cs.diceEntries) || 'keine Würfel';
    nameWrap.appendChild(tags);
    top.appendChild(nameWrap);

    row.appendChild(top);

    if (cs.description) {
      const desc = document.createElement('div');
      desc.className = 'item-row-desc';
      desc.textContent = cs.description;
      row.appendChild(desc);
    }

    const actions = document.createElement('div');
    actions.className = 'item-row-actions';
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Bearbeiten';
    editBtn.addEventListener('click', () => openCombatSkillModal(cs));
    actions.appendChild(editBtn);
    row.appendChild(actions);

    combatSkillsList.appendChild(row);
  });
}

addCombatSkillDiceBtn.addEventListener('click', () => {
  combatSkillDiceDraft.push({ id: generateId(), dieType: 'w6', count: 1, damageType: 'physisch', magicElement: '' });
  renderDraftDiceRows(combatSkillDiceRows, combatSkillDiceDraft);
});

function openCombatSkillModal(cs) {
  editingCombatSkillId = cs ? cs.id : null;
  combatSkillModalTitle.textContent = cs ? 'Kampfskill bearbeiten' : 'Neuer Kampfskill';
  combatSkillName.value = cs ? cs.name : '';
  combatSkillDescription.value = cs ? (cs.description || '') : '';
  combatSkillDiceDraft = cs ? (cs.diceEntries || []).map(e => ({ ...e })) : [];
  renderDraftDiceRows(combatSkillDiceRows, combatSkillDiceDraft);
  combatSkillDeleteBtn.classList.toggle('hidden', !cs);
  combatSkillSaveBtn.disabled = combatSkillName.value.trim().length === 0;
  combatSkillModal.classList.add('show');
  modalBackdrop.classList.add('show');
  setTimeout(() => combatSkillName.focus(), 50);
}

function closeCombatSkillModal() {
  combatSkillModal.classList.remove('show');
  modalBackdrop.classList.remove('show');
  editingCombatSkillId = null;
}

combatSkillName.addEventListener('input', () => {
  combatSkillSaveBtn.disabled = combatSkillName.value.trim().length === 0;
});

combatSkillCancelBtn.addEventListener('click', closeCombatSkillModal);

combatSkillSaveBtn.addEventListener('click', () => {
  const c = getCurrentCharacter();
  if (!c) return;
  const name = combatSkillName.value.trim();
  if (!name) return;
  const combatSkills = [...(c.combatSkills || [])];
  const entry = {
    id: editingCombatSkillId || generateId(),
    name,
    diceEntries: combatSkillDiceDraft.map(d => ({ ...d, id: d.id || generateId() })),
    description: combatSkillDescription.value.trim(),
    included: false
  };
  if (editingCombatSkillId) {
    const idx = combatSkills.findIndex(s => s.id === editingCombatSkillId);
    if (idx !== -1) entry.included = combatSkills[idx].included;
    if (idx !== -1) combatSkills[idx] = entry; else combatSkills.push(entry);
  } else {
    combatSkills.push(entry);
  }
  updateDoc(charRef(c.id), { combatSkills });
  closeCombatSkillModal();
});

combatSkillDeleteBtn.addEventListener('click', () => {
  const c = getCurrentCharacter();
  if (!c || !editingCombatSkillId) return;
  if (!window.confirm('Diesen Kampfskill wirklich löschen?')) return;
  const combatSkills = (c.combatSkills || []).filter(s => s.id !== editingCombatSkillId);
  updateDoc(charRef(c.id), { combatSkills });
  closeCombatSkillModal();
});

/* ---------- Waffen ---------- */

addWeaponBtn.addEventListener('click', () => openWeaponModal(null));

addDiceRowBtn.addEventListener('click', () => {
  weaponDiceDraft.push({ id: generateId(), dieType: 'w6', count: 1, damageType: 'physisch', magicElement: '' });
  renderDraftDiceRows(weaponDiceRows, weaponDiceDraft);
});

function openWeaponModal(weapon) {
  editingWeaponId = weapon ? weapon.id : null;
  weaponModalTitle.textContent = weapon ? 'Waffe bearbeiten' : 'Neue Waffe';
  weaponName.value = weapon ? weapon.name : '';
  weaponHandedness.value = weapon ? weapon.handedness : 'einhand';
  weaponRange.value = weapon ? weapon.range : 'nahkampf';
  weaponMagical.checked = weapon ? !!weapon.magical : false;
  weaponDescription.value = weapon ? (weapon.description || '') : '';
  weaponDiceDraft = weapon ? (weapon.diceEntries || []).map(e => ({ ...e })) : [];
  renderDraftDiceRows(weaponDiceRows, weaponDiceDraft);
  weaponDeleteBtn.classList.toggle('hidden', !weapon);
  weaponSaveBtn.disabled = weaponName.value.trim().length === 0;
  weaponModal.classList.add('show');
  modalBackdrop.classList.add('show');
  setTimeout(() => weaponName.focus(), 50);
}

function closeWeaponModal() {
  weaponModal.classList.remove('show');
  modalBackdrop.classList.remove('show');
  editingWeaponId = null;
}

weaponName.addEventListener('input', () => {
  weaponSaveBtn.disabled = weaponName.value.trim().length === 0;
});

weaponCancelBtn.addEventListener('click', closeWeaponModal);

weaponSaveBtn.addEventListener('click', () => {
  const c = getCurrentCharacter();
  if (!c) return;
  const name = weaponName.value.trim();
  if (!name) return;
  const weapons = [...(c.weapons || [])];
  const entry = {
    id: editingWeaponId || generateId(),
    name,
    handedness: weaponHandedness.value,
    range: weaponRange.value,
    magical: weaponMagical.checked,
    diceEntries: weaponDiceDraft.map(d => ({ ...d, id: d.id || generateId() })),
    description: weaponDescription.value.trim(),
    equipped: false,
    lastModifiedBy: me,
    lastModifiedAt: Date.now()
  };
  if (editingWeaponId) {
    const idx = weapons.findIndex(w => w.id === editingWeaponId);
    if (idx !== -1) entry.equipped = weapons[idx].equipped;
    if (idx !== -1) weapons[idx] = entry; else weapons.push(entry);
  } else {
    weapons.push(entry);
  }
  updateDoc(charRef(c.id), { weapons });
  closeWeaponModal();
});

weaponDeleteBtn.addEventListener('click', () => {
  const c = getCurrentCharacter();
  if (!c || !editingWeaponId) return;
  if (!window.confirm('Diese Waffe wirklich löschen?')) return;
  const weapons = (c.weapons || []).filter(w => w.id !== editingWeaponId);
  updateDoc(charRef(c.id), { weapons });
  closeWeaponModal();
});

function toggleEquip(c, weaponId) {
  const weapons = [...(c.weapons || [])];
  const w = weapons.find(x => x.id === weaponId);
  if (!w) return;
  const equippedCount = weapons.filter(x => x.equipped).length;
  if (!w.equipped && equippedCount >= 2) {
    alert('Es können maximal 2 Waffen gleichzeitig angelegt sein.');
    return;
  }
  w.equipped = !w.equipped;
  w.lastModifiedBy = me;
  w.lastModifiedAt = Date.now();
  updateDoc(charRef(c.id), { weapons });
}

function weaponTags(w) {
  const parts = [
    w.handedness === 'zweihand' ? 'Zweihand' : 'Einhand',
    w.range === 'fernkampf' ? 'Fernkampf' : 'Nahkampf'
  ];
  if (w.magical) parts.push('Magisch');
  if (w.diceEntries && w.diceEntries.length) parts.push(diceListLabel(w.diceEntries));
  return parts.join(' · ');
}

function renderWeaponsList(c) {
  if (!c) return;
  const weapons = [...(c.weapons || [])].sort((a, b) => {
    if (!!b.equipped !== !!a.equipped) return b.equipped ? 1 : -1;
    return (a.name || '').localeCompare(b.name || '');
  });
  weaponsList.innerHTML = '';
  weaponsEmpty.style.display = weapons.length ? 'none' : 'block';

  weapons.forEach(w => {
    const row = document.createElement('div');
    row.className = 'item-row' + (w.equipped ? ' equipped' : '');

    const top = document.createElement('div');
    top.className = 'item-row-top';

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'equip-checkbox' + (w.equipped ? ' checked' : '');
    check.setAttribute('aria-label', w.equipped ? 'Ablegen' : 'Anlegen');
    check.addEventListener('click', () => toggleEquip(c, w.id));
    top.appendChild(check);

    const nameWrap = document.createElement('div');
    nameWrap.style.flex = '1';
    const nameEl = document.createElement('div');
    nameEl.className = 'item-row-name';
    nameEl.textContent = w.name;
    nameWrap.appendChild(nameEl);
    const tags = document.createElement('div');
    tags.className = 'item-row-tags';
    tags.textContent = weaponTags(w);
    nameWrap.appendChild(tags);
    top.appendChild(nameWrap);

    row.appendChild(top);

    if (w.description) {
      const desc = document.createElement('div');
      desc.className = 'item-row-desc';
      desc.textContent = w.description;
      row.appendChild(desc);
    }

    if (w.lastModifiedBy) {
      const meta = document.createElement('div');
      meta.className = 'item-row-meta';
      meta.textContent = `Zuletzt geändert von ${w.lastModifiedBy}`;
      row.appendChild(meta);
    }

    const actions = document.createElement('div');
    actions.className = 'item-row-actions';

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Bearbeiten';
    editBtn.addEventListener('click', () => openWeaponModal(w));
    actions.appendChild(editBtn);

    const giveBtn = document.createElement('button');
    giveBtn.className = 'give';
    giveBtn.textContent = 'Geben';
    giveBtn.addEventListener('click', () => openGiveModal('weapon', w));
    actions.appendChild(giveBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = 'Löschen';
    delBtn.addEventListener('click', async () => {
      if (!window.confirm(`"${w.name}" wirklich löschen?`)) return;
      const weapons = (c.weapons || []).filter(x => x.id !== w.id);
      await updateDoc(charRef(c.id), { weapons });
    });
    actions.appendChild(delBtn);

    row.appendChild(actions);
    weaponsList.appendChild(row);
  });
}

/* ---------- Rüstungen ---------- */

addArmorPieceBtn.addEventListener('click', () => openArmorPieceModal(null));

function armorTags(a) {
  const wc = a.weightClass === 'schwer' ? 'Schwer' : a.weightClass === 'mittel' ? 'Mittel' : 'Leicht';
  return `${wc} · Rüstungswert ${a.armorValue || 0} · skaliert mit ${(a.scalesWith || 'dex').toUpperCase()}`;
}

function openArmorPieceModal(piece) {
  editingArmorPieceId = piece ? piece.id : null;
  armorPieceModalTitle.textContent = piece ? 'Rüstung bearbeiten' : 'Neue Rüstung';
  armorPieceName.value = piece ? piece.name : '';
  armorPieceWeightClass.value = piece ? piece.weightClass : 'leicht';
  armorPieceValue.value = piece ? piece.armorValue : 0;
  armorPieceScalesWith.value = piece ? piece.scalesWith : 'dex';
  armorPieceDescription.value = piece ? (piece.description || '') : '';
  armorPieceDeleteBtn.classList.toggle('hidden', !piece);
  armorPieceSaveBtn.disabled = armorPieceName.value.trim().length === 0;
  armorPieceModal.classList.add('show');
  modalBackdrop.classList.add('show');
  setTimeout(() => armorPieceName.focus(), 50);
}

function closeArmorPieceModal() {
  armorPieceModal.classList.remove('show');
  modalBackdrop.classList.remove('show');
  editingArmorPieceId = null;
}

armorPieceName.addEventListener('input', () => {
  armorPieceSaveBtn.disabled = armorPieceName.value.trim().length === 0;
});

armorPieceCancelBtn.addEventListener('click', closeArmorPieceModal);

armorPieceSaveBtn.addEventListener('click', () => {
  const c = getCurrentCharacter();
  if (!c) return;
  const name = armorPieceName.value.trim();
  if (!name) return;
  const armorPieces = [...(c.armorPieces || [])];
  const entry = {
    id: editingArmorPieceId || generateId(),
    name,
    weightClass: armorPieceWeightClass.value,
    armorValue: Number(armorPieceValue.value) || 0,
    scalesWith: armorPieceScalesWith.value,
    description: armorPieceDescription.value.trim(),
    equipped: false,
    lastModifiedBy: me,
    lastModifiedAt: Date.now()
  };
  if (editingArmorPieceId) {
    const idx = armorPieces.findIndex(a => a.id === editingArmorPieceId);
    if (idx !== -1) entry.equipped = armorPieces[idx].equipped;
    if (idx !== -1) armorPieces[idx] = entry; else armorPieces.push(entry);
  } else {
    armorPieces.push(entry);
  }
  updateDoc(charRef(c.id), { armorPieces });
  closeArmorPieceModal();
});

armorPieceDeleteBtn.addEventListener('click', () => {
  const c = getCurrentCharacter();
  if (!c || !editingArmorPieceId) return;
  if (!window.confirm('Diese Rüstung wirklich löschen?')) return;
  const armorPieces = (c.armorPieces || []).filter(a => a.id !== editingArmorPieceId);
  updateDoc(charRef(c.id), { armorPieces });
  closeArmorPieceModal();
});

function toggleArmorEquip(c, pieceId) {
  const armorPieces = [...(c.armorPieces || [])];
  const a = armorPieces.find(x => x.id === pieceId);
  if (!a) return;
  a.equipped = !a.equipped;
  a.lastModifiedBy = me;
  a.lastModifiedAt = Date.now();
  updateDoc(charRef(c.id), { armorPieces });
}

function renderArmorPiecesList(c) {
  if (!c) return;
  const pieces = [...(c.armorPieces || [])].sort((a, b) => {
    if (!!b.equipped !== !!a.equipped) return b.equipped ? 1 : -1;
    return (a.name || '').localeCompare(b.name || '');
  });
  armorPiecesList.innerHTML = '';
  armorPiecesEmpty.style.display = pieces.length ? 'none' : 'block';

  pieces.forEach(a => {
    const row = document.createElement('div');
    row.className = 'item-row' + (a.equipped ? ' equipped' : '');

    const top = document.createElement('div');
    top.className = 'item-row-top';

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'equip-checkbox' + (a.equipped ? ' checked' : '');
    check.setAttribute('aria-label', a.equipped ? 'Ablegen' : 'Anlegen');
    check.addEventListener('click', () => toggleArmorEquip(c, a.id));
    top.appendChild(check);

    const nameWrap = document.createElement('div');
    nameWrap.style.flex = '1';
    const nameEl = document.createElement('div');
    nameEl.className = 'item-row-name';
    nameEl.textContent = a.name;
    nameWrap.appendChild(nameEl);
    const tags = document.createElement('div');
    tags.className = 'item-row-tags';
    tags.textContent = armorTags(a);
    nameWrap.appendChild(tags);
    top.appendChild(nameWrap);

    row.appendChild(top);

    if (a.description) {
      const desc = document.createElement('div');
      desc.className = 'item-row-desc';
      desc.textContent = a.description;
      row.appendChild(desc);
    }

    if (a.lastModifiedBy) {
      const meta = document.createElement('div');
      meta.className = 'item-row-meta';
      meta.textContent = `Zuletzt geändert von ${a.lastModifiedBy}`;
      row.appendChild(meta);
    }

    const actions = document.createElement('div');
    actions.className = 'item-row-actions';

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Bearbeiten';
    editBtn.addEventListener('click', () => openArmorPieceModal(a));
    actions.appendChild(editBtn);

    const giveBtn = document.createElement('button');
    giveBtn.className = 'give';
    giveBtn.textContent = 'Geben';
    giveBtn.addEventListener('click', () => openGiveModal('armor', a));
    actions.appendChild(giveBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = 'Löschen';
    delBtn.addEventListener('click', async () => {
      if (!window.confirm(`"${a.name}" wirklich löschen?`)) return;
      const armorPieces = (c.armorPieces || []).filter(x => x.id !== a.id);
      await updateDoc(charRef(c.id), { armorPieces });
    });
    actions.appendChild(delBtn);

    row.appendChild(actions);
    armorPiecesList.appendChild(row);
  });
}

/* ---------- Gegenstände ---------- */

addItemBtn.addEventListener('click', () => openItemModal(null));

function openItemModal(item) {
  editingItemId = item ? item.id : null;
  itemModalTitle.textContent = item ? 'Gegenstand bearbeiten' : 'Neuer Gegenstand';
  itemName.value = item ? item.name : '';
  itemQty.value = item ? item.qty : 1;
  itemEffect.value = item ? (item.effect || '') : '';
  itemDeleteBtn.classList.toggle('hidden', !item);
  itemSaveBtn.disabled = itemName.value.trim().length === 0;
  itemModal.classList.add('show');
  modalBackdrop.classList.add('show');
  setTimeout(() => itemName.focus(), 50);
}

function closeItemModal() {
  itemModal.classList.remove('show');
  modalBackdrop.classList.remove('show');
  editingItemId = null;
}

itemName.addEventListener('input', () => {
  itemSaveBtn.disabled = itemName.value.trim().length === 0;
});

itemCancelBtn.addEventListener('click', closeItemModal);

itemSaveBtn.addEventListener('click', () => {
  const c = getCurrentCharacter();
  if (!c) return;
  const name = itemName.value.trim();
  if (!name) return;
  const items = [...(c.items || [])];
  const entry = {
    id: editingItemId || generateId(),
    name,
    qty: Math.max(1, parseInt(itemQty.value, 10) || 1),
    effect: itemEffect.value.trim(),
    lastModifiedBy: me,
    lastModifiedAt: Date.now()
  };
  if (editingItemId) {
    const idx = items.findIndex(i => i.id === editingItemId);
    if (idx !== -1) items[idx] = entry; else items.push(entry);
  } else {
    items.push(entry);
  }
  updateDoc(charRef(c.id), { items });
  closeItemModal();
});

itemDeleteBtn.addEventListener('click', () => {
  const c = getCurrentCharacter();
  if (!c || !editingItemId) return;
  if (!window.confirm('Diesen Gegenstand wirklich löschen?')) return;
  const items = (c.items || []).filter(i => i.id !== editingItemId);
  updateDoc(charRef(c.id), { items });
  closeItemModal();
});

function renderItemsList(c) {
  if (!c) return;
  const items = [...(c.items || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  itemsList.innerHTML = '';
  itemsEmpty.style.display = items.length ? 'none' : 'block';

  items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'item-row';

    const top = document.createElement('div');
    top.className = 'item-row-top';

    const qtyBadge = document.createElement('div');
    qtyBadge.className = 'item-qty-badge';
    qtyBadge.textContent = `${it.qty}×`;
    top.appendChild(qtyBadge);

    const nameEl = document.createElement('div');
    nameEl.className = 'item-row-name';
    nameEl.textContent = it.name;
    top.appendChild(nameEl);

    row.appendChild(top);

    if (it.effect) {
      const desc = document.createElement('div');
      desc.className = 'item-row-desc';
      desc.textContent = it.effect;
      row.appendChild(desc);
    }

    if (it.lastModifiedBy) {
      const meta = document.createElement('div');
      meta.className = 'item-row-meta';
      meta.textContent = `Zuletzt geändert von ${it.lastModifiedBy}`;
      row.appendChild(meta);
    }

    const actions = document.createElement('div');
    actions.className = 'item-row-actions';

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Bearbeiten';
    editBtn.addEventListener('click', () => openItemModal(it));
    actions.appendChild(editBtn);

    const giveBtn = document.createElement('button');
    giveBtn.className = 'give';
    giveBtn.textContent = 'Geben';
    giveBtn.addEventListener('click', () => openGiveModal('item', it));
    actions.appendChild(giveBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = 'Löschen';
    delBtn.addEventListener('click', async () => {
      if (!window.confirm(`"${it.name}" wirklich löschen?`)) return;
      const items = (c.items || []).filter(x => x.id !== it.id);
      await updateDoc(charRef(c.id), { items });
    });
    actions.appendChild(delBtn);

    row.appendChild(actions);
    itemsList.appendChild(row);
  });
}

/* ---------- Inventar-Übersicht (nur angelegte Sachen im Normal-Modus) ---------- */

function renderInvSummaryRow(name, tags, desc) {
  const row = document.createElement('div');
  row.className = 'inv-summary-row';
  const n = document.createElement('div');
  n.className = 'inv-summary-name';
  n.textContent = name;
  row.appendChild(n);
  if (tags) {
    const t = document.createElement('div');
    t.className = 'inv-summary-tags';
    t.textContent = tags;
    row.appendChild(t);
  }
  if (desc) {
    const d = document.createElement('div');
    d.className = 'inv-summary-desc';
    d.textContent = desc;
    row.appendChild(d);
  }
  return row;
}

function renderInventorySummaries(c) {
  const weapons = equippedWeapons(c);
  equippedWeaponsSummary.innerHTML = '';
  equippedWeaponsEmpty.style.display = weapons.length ? 'none' : 'block';
  weapons.forEach(w => equippedWeaponsSummary.appendChild(renderInvSummaryRow(w.name, weaponTags(w), w.description)));

  const armorPieces = equippedArmorPieces(c);
  equippedArmorSummary.innerHTML = '';
  equippedArmorEmpty.style.display = armorPieces.length ? 'none' : 'block';
  armorPieces.forEach(a => equippedArmorSummary.appendChild(renderInvSummaryRow(a.name, armorTags(a), a.description)));
}

/* ---------- Geben ---------- */

function openGiveModal(type, entry) {
  const c = getCurrentCharacter();
  if (!c) return;
  giveContext = { type, entryId: entry.id, sourceCharId: c.id, maxQty: entry.qty || 1 };
  giveModalTitle.textContent = `"${entry.name}" weitergeben`;

  giveTargetSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '-- Charakter wählen --';
  giveTargetSelect.appendChild(placeholder);
  characters.filter(other => other.id !== c.id).forEach(other => {
    const opt = document.createElement('option');
    opt.value = other.id;
    opt.textContent = other.name;
    giveTargetSelect.appendChild(opt);
  });

  giveQtyRow.classList.toggle('hidden', type !== 'item');
  if (type === 'item') {
    giveQty.max = giveContext.maxQty;
    giveQty.value = giveContext.maxQty;
  }

  giveConfirmBtn.disabled = true;
  giveModal.classList.add('show');
  modalBackdrop.classList.add('show');
}

function closeGiveModal() {
  giveModal.classList.remove('show');
  modalBackdrop.classList.remove('show');
  giveContext = null;
}

giveTargetSelect.addEventListener('change', () => {
  giveConfirmBtn.disabled = giveTargetSelect.value.length === 0;
});

giveCancelBtn.addEventListener('click', closeGiveModal);

giveConfirmBtn.addEventListener('click', async () => {
  if (!giveContext) return;
  const targetId = giveTargetSelect.value;
  if (!targetId) return;
  const { type, entryId, sourceCharId } = giveContext;
  const sourceRef = charRef(sourceCharId);
  const targetRef = charRef(targetId);

  giveConfirmBtn.disabled = true;
  try {
    await runTransaction(db, async (tx) => {
      const sourceSnap = await tx.get(sourceRef);
      const targetSnap = await tx.get(targetRef);
      if (!sourceSnap.exists() || !targetSnap.exists()) throw new Error('Charakter nicht mehr vorhanden');
      const sourceData = sourceSnap.data();
      const targetData = targetSnap.data();

      if (type === 'weapon') {
        const weapons = [...(sourceData.weapons || [])];
        const idx = weapons.findIndex(w => w.id === entryId);
        if (idx === -1) throw new Error('Waffe nicht mehr vorhanden');
        const [w] = weapons.splice(idx, 1);
        w.equipped = false;
        w.lastModifiedBy = me;
        w.lastModifiedAt = Date.now();
        const targetWeapons = [...(targetData.weapons || []), w];
        tx.update(sourceRef, { weapons });
        tx.update(targetRef, { weapons: targetWeapons });
      } else if (type === 'armor') {
        const armorPieces = [...(sourceData.armorPieces || [])];
        const idx = armorPieces.findIndex(a => a.id === entryId);
        if (idx === -1) throw new Error('Rüstung nicht mehr vorhanden');
        const [a] = armorPieces.splice(idx, 1);
        a.equipped = false;
        a.lastModifiedBy = me;
        a.lastModifiedAt = Date.now();
        const targetArmorPieces = [...(targetData.armorPieces || []), a];
        tx.update(sourceRef, { armorPieces });
        tx.update(targetRef, { armorPieces: targetArmorPieces });
      } else {
        const amount = Math.max(1, parseInt(giveQty.value, 10) || 1);
        const items = [...(sourceData.items || [])];
        const idx = items.findIndex(i => i.id === entryId);
        if (idx === -1) throw new Error('Gegenstand nicht mehr vorhanden');
        const srcItem = items[idx];
        const take = Math.min(amount, srcItem.qty);
        if (take <= 0) throw new Error('Ungültige Menge');
        if (take >= srcItem.qty) items.splice(idx, 1);
        else items[idx] = { ...srcItem, qty: srcItem.qty - take, lastModifiedBy: me, lastModifiedAt: Date.now() };

        const targetItems = [...(targetData.items || [])];
        const existingIdx = targetItems.findIndex(i => i.name.trim().toLowerCase() === srcItem.name.trim().toLowerCase());
        if (existingIdx !== -1) {
          targetItems[existingIdx] = {
            ...targetItems[existingIdx],
            qty: targetItems[existingIdx].qty + take,
            lastModifiedBy: me,
            lastModifiedAt: Date.now()
          };
        } else {
          targetItems.push({
            id: generateId(), name: srcItem.name, qty: take, effect: srcItem.effect,
            lastModifiedBy: me, lastModifiedAt: Date.now()
          });
        }
        tx.update(sourceRef, { items });
        tx.update(targetRef, { items: targetItems });
      }
    });
    closeGiveModal();
  } catch (e) {
    alert(e.message || 'Weitergeben fehlgeschlagen.');
  } finally {
    giveConfirmBtn.disabled = false;
  }
});

/* ---------- Quest-Log ---------- */

addQuestLogBtn.addEventListener('click', () => {
  const c = getCurrentCharacter();
  if (!c) return;
  const text = questLogInput.value.trim();
  if (!text) return;
  const questLog = [...(c.questLog || []), {
    id: generateId(), text, author: me, timestamp: Date.now()
  }];
  updateDoc(charRef(c.id), { questLog });
  questLogInput.value = '';
});

function renderQuestLog(c) {
  const entries = [...(c.questLog || [])].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  questLogList.innerHTML = '';
  questLogEmpty.style.display = entries.length ? 'none' : 'block';

  entries.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'questlog-entry';

    const text = document.createElement('div');
    text.className = 'questlog-entry-text';
    text.textContent = entry.text;
    row.appendChild(text);

    const meta = document.createElement('div');
    meta.className = 'questlog-entry-meta';
    meta.textContent = `${entry.author || '?'} · ${formatDateTime(entry.timestamp)}`;
    row.appendChild(meta);

    questLogList.appendChild(row);
  });
}

/* ---------- Sheet: Gesamt-Render ---------- */

function setValueIfNotFocused(inputEl, value) {
  if (document.activeElement === inputEl) return;
  inputEl.value = value;
}

function renderCharacterSheet() {
  const c = getCurrentCharacter();
  if (!c) return;

  if (sheetMode === 'normal') {
    setValueIfNotFocused(chName, c.name || '');
    setValueIfNotFocused(chAncestry, c.ancestry || '');
    setValueIfNotFocused(chClass, c.className || '');
    levelValue.textContent = c.level || 1;
    setValueIfNotFocused(statStr, c.attributes?.str ?? 0);
    setValueIfNotFocused(statDex, c.attributes?.dex ?? 0);
    setValueIfNotFocused(statInt, c.attributes?.int ?? 0);
    setValueIfNotFocused(statWil, c.attributes?.wil ?? 0);
    setValueIfNotFocused(hpCurrent, c.hp?.current ?? 0);
    setValueIfNotFocused(hpMax, c.hp?.max ?? 0);
    setValueIfNotFocused(hpTemp, c.hp?.temp ?? 0);
    setValueIfNotFocused(initiative, c.initiative ?? 0);
    setValueIfNotFocused(chSize, c.size || '');
    setValueIfNotFocused(chSpeed, c.speed || '');
    setValueIfNotFocused(chWeight, c.weight || '');
    setValueIfNotFocused(woundsMax, c.wounds?.max ?? 5);
    setValueIfNotFocused(curCopper, c.currency?.copper ?? 0);
    setValueIfNotFocused(curSilver, c.currency?.silver ?? 0);
    setValueIfNotFocused(curGold, c.currency?.gold ?? 0);
    setValueIfNotFocused(curPlatinum, c.currency?.platinum ?? 0);

    renderWoundsPips(c);
    renderSkillsGrid(c);
    renderAbilitiesList(c);
    renderInventorySummaries(c);
    renderQuestLog(c);
  } else {
    renderCombatQuick(c);
    renderArmorComposite(c);
    renderAttack(c);
  }

  if (!weaponsListView.classList.contains('hidden')) renderWeaponsList(c);
  if (!armorListView.classList.contains('hidden')) renderArmorPiecesList(c);
  if (!itemsListView.classList.contains('hidden')) renderItemsList(c);
}

/* ---------- Firestore-Listener ---------- */

onSnapshot(query(collection(db, 'storyline'), orderBy('createdAt', 'desc')), (snap) => {
  storylineEntries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderStoryline();
});

onSnapshot(query(collection(db, 'characters'), orderBy('name', 'asc')), (snap) => {
  characters = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (activeSection === 'characters') {
    if (currentCharacterId) {
      if (getCurrentCharacter()) {
        renderCharacterSheet();
      } else {
        showCharList();
      }
    } else {
      renderCharList();
    }
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

updateFabVisibility();
showOnboardingIfNeeded();
