// of-engine.js
// Moteur de génération d'Ordre de Fabrication (OF)
// = Logique métier pure, sans DOM, sans Firebase.
// Utilise les fiches techniques + commandes du chef
// pour calculer les besoins agrégés et l'ordre de lancement.
//
// v2 — corrections :
//  • horaires : les produits qui pousse longtemps sont lancés en premier, et le produit suivant
//    démarre dès que l'équipe est libre (la pousse ne bloque pas le fournil) ;
//  • temps total = durée réelle de la production (début → fin estimée), plus multiplié par la taille du lot ;
//  • liquides (ml / L) gardés en litres dans les besoins globaux ;
//  • lignes ignorées signalées (poids de pièce crue ou ingrédients manquants) au lieu d'être perdues en silence ;
//  • détail par produit : ingrédients mis à l'échelle et étapes horodatées.

const TO_G = { g:1, kg:1000, ml:1, L:1000 };
const LIQ  = { ml:true, L:true };

function localISODate(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

/**
 * Génère un OF complet à partir des commandes.
 * @param {Array}  commandes  [{ ficheId, quantite, unite: 'piece'|'kg'|'plaque' }]
 *                            piece = nombre de pièces · kg = kg de pâte · plaque = nombre de fois la recette de base
 * @param {Array}  fiches     Catalogue fiches techniques
 * @param {Object} opts       { debutMin: 540 (9h00 en minutes), tampon: 15 (min entre deux lancements), jour: 'YYYY-MM-DD' }
 * @returns {Object}          OF complet, prêt à afficher, imprimer ou enregistrer
 */
export function genererOF(commandes, fiches, opts = {}){
  const debutMin = opts.debutMin ?? (9 * 60);
  const tampon   = opts.tampon ?? 15;
  const jour     = opts.jour || localISODate();
  const ficheMap = new Map(fiches.map(f => [f.id, f]));
  const besoins  = new Map();
  const lignes   = [];
  const ignores  = [];
  let coutTotal  = 0;

  for(const cmd of commandes){
    const f = ficheMap.get(cmd.ficheId);
    if(!f){ ignores.push({ ficheId: cmd.ficheId, nom: '', raison: 'introuvable' }); continue; }
    const quantite = Number(cmd.quantite) || 0;
    if(quantite <= 0){ ignores.push({ ficheId: f.id, nom: f.nomFr, raison: 'quantite' }); continue; }

    // 1) Facteur multiplicateur par rapport à la recette de base
    const stats = calcStats(f);
    let facteur = 0;
    if(cmd.unite === 'piece'){
      facteur = stats.nb > 0 ? quantite / stats.nb : 0;
    } else if(cmd.unite === 'kg'){
      facteur = stats.pate_g > 0 ? (quantite * 1000) / stats.pate_g : 0;
    } else if(cmd.unite === 'plaque'){
      facteur = quantite;
    }
    if(facteur <= 0){
      ignores.push({ ficheId: f.id, nom: f.nomFr, raison: cmd.unite === 'piece' ? 'poids_piece' : 'pate' });
      continue;
    }

    // 2) Cumul des ingrédients (liste de courses du labo)
    let coutFiche = 0;
    const ingLigne = [];
    (f.ingredients || []).forEach(ing => {
      const base = Number(ing.qte) || 0;
      const key  = String(ing.nom || '').trim().toLowerCase();
      if(!key || base <= 0) return;
      const liq   = !!LIQ[ing.unite];
      const qte_g = base * (TO_G[ing.unite] || 1) * facteur;
      const cout  = qte_g / 1000 * (Number(ing.prix) || 0);
      const cur = besoins.get(key) || { nom: ing.nom, qte_g: 0, cout: 0, liq };
      cur.qte_g += qte_g;
      cur.cout  += cout;
      if(cur.liq !== liq) cur.liq = false;      // mélange liquide / solide : on garde la masse
      besoins.set(key, cur);
      coutFiche += cout;
      ingLigne.push({ nom: ing.nom, qte_g: Math.round(qte_g * 10) / 10, liq });
    });
    coutTotal += coutFiche;

    // 3) Étapes et durées (une recette = un cycle, la durée ne dépend pas de la taille du lot)
    const etapes = (f.etapes || []).map(e => ({
      type: e.type, desc: e.desc || '', duree: Number(e.duree) || 0, temp: e.temp || ''
    }));
    const tFiche = etapes.reduce((s,e) => s + e.duree, 0);
    const tempsPousse = etapes
      .filter(e => e.type === 'pointage' || e.type === 'appret')
      .reduce((s,e) => s + e.duree, 0);

    lignes.push({
      ficheId: f.id,
      code: f.code,
      nomFr: f.nomFr,
      nomAr: f.nomAr || '',
      famille: f.famille,
      quantite,
      unite: cmd.unite,
      facteur: Math.round(facteur * 1000) / 1000,
      pieces: Math.round((stats.nb || 0) * facteur),
      pate_g: Math.round((stats.pate_g || 0) * facteur),
      cout: Math.round(coutFiche * 100) / 100,
      tempsPousse: Math.round(tempsPousse),
      tFiche: Math.round(tFiche),
      ingredients: ingLigne,
      etapes,
      heureLancement: null
    });
  }

  // 4) Ordre de lancement : ce qui pousse le plus longtemps démarre le plus tôt.
  //    Le produit suivant démarre quand l'équipe a fini le travail actif du précédent (hors pousse) + tampon.
  const ordre = [...lignes].sort((a,b) => (b.tempsPousse - a.tempsPousse) || (b.tFiche - a.tFiche));
  let curseur = debutMin;
  let fin = debutMin;
  ordre.forEach(l => {
    l.heureLancement = curseur;
    const actif = Math.max(l.tFiche - l.tempsPousse, 0);
    curseur += actif + tampon;
    fin = Math.max(fin, l.heureLancement + l.tFiche);
    let t = l.heureLancement;                   // horodatage de chaque étape
    l.etapes.forEach(e => { e.debut = t; t += e.duree; });
  });

  // 5) Besoins formatés : g → kg (ou ml → L) à partir de 1000
  const besoinsGlobaux = [...besoins.values()].map(b => {
    const grand = b.qte_g >= 1000;
    return {
      nom: b.nom,
      qte_g: Math.round(b.qte_g),
      qte: grand ? Math.round(b.qte_g / 100) / 10 : Math.round(b.qte_g),
      unite: b.liq ? (grand ? 'L' : 'ml') : (grand ? 'kg' : 'g'),
      cout: Math.round(b.cout * 100) / 100
    };
  }).sort((a,b) => b.qte_g - a.qte_g);

  return {
    id: 'OF-' + jour,
    jour,
    date: new Date().toISOString(),
    debutMin,
    lignes: [...lignes].sort((a,b) => a.heureLancement - b.heureLancement),
    besoinsGlobaux,
    coutTotal: Math.round(coutTotal * 100) / 100,
    tempsTotal: Math.round(fin - debutMin),
    finEstimee: Math.round(fin),
    ignores
  };
}

/** Extrait les stats d'une fiche (rendement, pâte totale) sans importer le module de calcul complet */
function calcStats(f){
  let pate_g = 0;
  (f.ingredients || []).forEach(i => {
    pate_g += (Number(i.qte) || 0) * (TO_G[i.unite] || 1);
  });
  const crue = Number(f.pieceCrue) || 0;
  const nb = crue > 0 ? Math.floor(pate_g / crue) : 0;
  return { pate_g, nb };
}

/** Formate les minutes depuis minuit en "HH:MM" */
export function hhmm(mn){
  const total = Math.round(mn);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}

/** Formate une durée en minutes vers "Xh YYmin" */
export function duree(min){
  const t = Math.round(min);
  if(t < 60) return t + ' min';
  const h = Math.floor(t / 60);
  const m = t % 60;
  return h + 'h' + String(m).padStart(2,'0');
}
