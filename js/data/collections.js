import pbl from "./pbl.js";
import cri from "./cri.js";
import por from "./por.js";
import asc from "./asc.js";
import pfl from "./pfl.js";
import meg from "./meg.js";
import blk from "./blk.js";
import wht from "./wht.js";
import dri from "./dri.js";
import jtg from "./jtg.js";
import pre from "./pre.js";
import ssp from "./ssp.js";
import scr from "./scr.js";
import sfa from "./sfa.js";
import twm from "./twm.js";
import tef from "./tef.js";
import paf from "./paf.js";
import par from "./par.js";
import mew from "./mew.js";
import obf from "./obf.js";
import pal from "./pal.js";
import svi from "./svi.js";
import brs from "./brs.js";
import fst from "./fst.js";
import ssh from "./ssh.js";
import flf from "./flf.js";
import mep from "./mep.js";
import svp from "./svp.js";

export const COLLECTIONS = [
 {
    id: "pbl",
    name: "Oscuridad Absoluta [PBL]",
    eyebrow: "Set PBL · Trainer Box",
    storageKey: "pbl-collection",
    gameSetMax: 84,
    tcgdexSeries: "me",
    tcgdexSet: "me05",
    accent: "var(--poke)",
    seed: pbl,
  },
  {
    id: "cri",
    name: "Caos Creciente [CRI]",
    eyebrow: "Set CRI · Trainer Box",
    storageKey: "cri-collection",
    gameSetMax: 86,
    tcgdexSeries: "me",
    tcgdexSet: "me04",
    accent: "var(--poke)",
    seed: cri
  },
  {
    id: "por",
    name: "Equilibrio Perfecto [POR]",
    eyebrow: "Set POR · Trainer Box",
    storageKey: "por-collection",
    gameSetMax: 88,
    tcgdexSeries: "me",
    tcgdexSet: "me03",
    accent: "var(--poke)",
    seed: por
  },
  {
    id: "asc",
    name: "Héroes Ascendentes [ASC]",
    eyebrow: "Set ASC · Trainer Box",
    storageKey: "asc-collection",
    gameSetMax: 217,
    tcgdexSeries: "me",
    tcgdexSet: "me02.5",
    accent: "var(--poke)",
    seed: asc
  },
  {
    id: "pfl",
    name: "Fuegos Fantasmales [PFL]",
    eyebrow: "Set PFL · Trainer Box",
    storageKey: "pfl-collection",
    gameSetMax: 94,
    tcgdexSeries: "me",
    tcgdexSet: "me02",
    accent: "var(--poke)",
    seed: pfl
  },
  {
    id: "meg",
    name: "Megaevolución [MEG]",
    eyebrow: "Set MEG · Trainer Box",
    storageKey: "meg-collection",
    gameSetMax: 132,
    tcgdexSeries: "me",
    tcgdexSet: "me01",
    accent: "var(--poke)",
    seed: meg
  },
  {
    id: "blk",
    name: "Fulgor Negro [BLK]",
    eyebrow: "Set BLK · Trainer Box",
    storageKey: "blk-collection",
    gameSetMax: 86,
    tcgdexSeries: "sv",
    tcgdexSet: "sv10.5b",
    accent: "var(--poke)",
    seed: blk
  },
  {
    id: "wht",
    name: "Llama Blanca [WHT]",
    eyebrow: "Set WHT · Trainer Box",
    storageKey: "wht-collection",
    gameSetMax: 86,
    tcgdexSeries: "sv",
    tcgdexSet: "sv10.5w",
    accent: "var(--poke)",
    seed: wht
  },
  {
    id: "dri",
    name: "Rivales Predestinados [DRI]",
    eyebrow: "Set DRI · Trainer Box",
    storageKey: "dri-collection",
    gameSetMax: 182,
    tcgdexSeries: "sv",
    tcgdexSet: "sv10",
    accent: "var(--poke)",
    seed: dri
  },
  {
    id: "jtg",
    name: "Juntos de Aventuras [JTG]",
    eyebrow: "Set JTG · Trainer Box",
    storageKey: "jtg-collection",
    gameSetMax: 159,
    tcgdexSeries: "sv",
    tcgdexSet: "sv09",
    accent: "var(--poke)",
    seed: jtg
  },
  {
    id: "pre",
    name: "Evoluciones Prismáticas [PRE]",
    eyebrow: "Set PRE · Trainer Box",
    storageKey: "pre-collection",
    gameSetMax: 131,
    tcgdexSeries: "sv",
    tcgdexSet: "sv08.5",
    accent: "var(--poke)",
    seed: pre
  },
  {
    id: "ssp",
    name: "Chispas Fulgurantes [SSP]",
    eyebrow: "Set SSP · Trainer Box",
    storageKey: "ssp-collection",
    gameSetMax: 191,
    tcgdexSeries: "sv",
    tcgdexSet: "sv08",
    accent: "var(--poke)",
    seed: ssp
  },
  {
    id: "scr",
    name: "Corona Astral [SCR]",
    eyebrow: "Set SCR · Trainer Box",
    storageKey: "scr-collection",
    gameSetMax: 142,
    tcgdexSeries: "sv",
    tcgdexSet: "sv07",
    accent: "var(--poke)",
    seed: scr
  },
  {
    id: "sfa",
    name: "Fábula Sombría [SFA]",
    eyebrow: "Set SFA · Trainer Box",
    storageKey: "sfa-collection",
    gameSetMax: 64,
    tcgdexSeries: "sv",
    tcgdexSet: "sv06.5",
    accent: "var(--poke)",
    seed: sfa
  },
  {
    id: "twm",
    name: "Mascarada Crepuscular [TWM]",
    eyebrow: "Set TWM · Trainer Box",
    storageKey: "twm-collection",
    gameSetMax: 167,
    tcgdexSeries: "sv",
    tcgdexSet: "sv06",
    accent: "var(--poke)",
    seed: twm
  },
  {
    id: "tef",
    name: "Fuerzas Temporales [TEF]",
    eyebrow: "Set TEF · Trainer Box",
    storageKey: "tef-collection",
    gameSetMax: 162,
    tcgdexSeries: "sv",
    tcgdexSet: "sv05",
    accent: "var(--poke)",
    seed: tef
  },
  {
    id: "paf",
    name: "Destinos de Paldea [PAF]",
    eyebrow: "Set PAF · Trainer Box",
    storageKey: "paf-collection",
    gameSetMax: 91,
    tcgdexSeries: "sv",
    tcgdexSet: "sv04.5",
    accent: "var(--poke)",
    seed: paf
  },
  {
    id: "par",
    name: "Brecha Paradójica [PAR]",
    eyebrow: "Set PAR · Trainer Box",
    storageKey: "par-collection",
    gameSetMax: 182,
    tcgdexSeries: "sv",
    tcgdexSet: "sv04",
    accent: "var(--poke)",
    seed: par
  },
  {
    id: "mew",
    name: "Pokémon 151 [MEW]",
    eyebrow: "Set MEW · Trainer Box",
    storageKey: "mew-collection",
    gameSetMax: 165,
    tcgdexSeries: "sv",
    tcgdexSet: "sv03.5",
    accent: "var(--poke)",
    seed: mew
  },
  {
    id: "obf",
    name: "Llamas Obsidianas [OBF]",
    eyebrow: "Set OBF · Trainer Box",
    storageKey: "obf-collection",
    gameSetMax: 197,
    tcgdexSeries: "sv",
    tcgdexSet: "sv03",
    accent: "var(--poke)",
    seed: obf
  },
  {
    id: "pal",
    name: "Evoluciones en Paldea [PAL]",
    eyebrow: "Set PAL · Trainer Box",
    storageKey: "pal-collection",
    gameSetMax: 193,
    tcgdexSeries: "sv",
    tcgdexSet: "sv02",
    accent: "var(--poke)",
    seed: pal
  },
  {
    id: "svi",
    name: "Escarlata y Púrpura [SVI]",
    eyebrow: "Set SVI · Trainer Box",
    storageKey: "svi-collection",
    gameSetMax: 198,
    tcgdexSeries: "sv",
    tcgdexSet: "sv01",
    accent: "var(--poke)",
    seed: svi
  },
  {
    id: "brs",
    name: "Astros Brillantes [BRS]",
    eyebrow: "Set BRS · Trainer Box",
    storageKey: "brs-collection",
    gameSetMax: 165,
    tcgdexSeries: "swsh",
    tcgdexSet: "swsh9",
    accent: "var(--poke)",
    seed: brs
  },
  {
    id: "fst",
    name: "Golpe Fusión [FST]",
    eyebrow: "Set FST · Trainer Box",
    storageKey: "fst-collection",
    gameSetMax: 264,
    tcgdexSeries: "swsh",
    tcgdexSet: "swsh8",
    accent: "var(--poke)",
    seed: fst
  },
  {
    id: "ssh",
    name: "Espada y Escudo [SSH]",
    eyebrow: "Set SSH · Trainer Box",
    storageKey: "ssh-collection",
    gameSetMax: 202,
    tcgdexSeries: "swsh",
    tcgdexSet: "swsh1",
    accent: "var(--poke)",
    seed: ssh
  },
  {
    id: "flf",
    name: "Destellos de Fuego [FLF]",
    eyebrow: "Set FLF · Trainer Box",
    storageKey: "flf-collection",
    gameSetMax: 106,
    tcgdexSeries: "xy",
    tcgdexSet: "xy2",
    accent: "var(--poke)",
    seed: flf
  },                                           
  {
    id: "bsp",
    name: "Black Star Promos",
    eyebrow: "Promos · Trainer Box",
    accent: "var(--poke)",
    // Colección compuesta: no tiene seed/gameSetMax propios, sino que agrupa
    // varias tandas de promos (una por temporada). Cada subcolección se
    // carga y almacena de forma independiente (mismo storageKey que id),
    // pero de cara al usuario se presentan juntas bajo "Black Star Promos".
    subcollections: [
      {
        id: "mep",
        name: "Black Star Promos - MEP",
        storageKey: "mep-collection",
        gameSetMax: null, // sin distinción Play Set/Master Set: se muestran las 4 variantes (set real: 110 cartas)
        tcgdexSeries: "me",
        tcgdexSet: "mep",
        seed: mep
      },
      {
        id: "svp",
        name: "Black Star Promos - SVP",
        storageKey: "svp-collection",
        gameSetMax: null, // sin distinción Play Set/Master Set: se muestran las 4 variantes (set real: 225 cartas)
        tcgdexSeries: "sv",
        tcgdexSet: "svp",
        seed: svp
      }
    ]
  }
];