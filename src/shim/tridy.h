/* IQ Pokyd - src/shim/tridy.h - the three data structures the engine is built on.

   These are not ours and they are not stubs: they are lines 43-130 of
   !Prostre/IQPokyd.h, verbatim.  The source drop's Aplikace/ tree is not
   self-contained -- Vstup/NASTAVEN.TR still calls itself "soubor s definici
   tridy pro nastaveni" and Intelig/INTELIG.TR "definice trid Typ_slova a
   Struktura_vety", but the author had long since moved both class bodies into
   the MFC header and left forward declarations behind.  Compiling Aplikace/
   without !Prostre/ therefore means bringing them back, and bringing them back
   here rather than into src/engine/ keeps that tree a byte-exact mirror of the
   original (tools/transcode.py --check).

   IQPokyd.h defines two more classes in the same block, IQPokydWav (the click
   sounds, mmsystem) and RozvrzeniVet (the last 100 lines, CString).  Nothing
   outside Prostred/ touches either, so they stay out; NASTAVEN.TR's forward
   declaration of RozvrzeniVet is all the BEZ_PROSTREDI build ever needs.

   One line differs from the original, marked [shim] below: MSVC 6 accepted a
   member declared as `void Typ_slova::ZKOPIRUJ_...` inside class Typ_slova
   itself; ISO C++ does not, and gcc rejects it as an extra qualification.  The
   qualifier is dropped, which declares exactly the same member function.

   Ordering: this comes after hlavicky.in, exactly as in IQPokyd.h, because
   Struktura_vety sizes an array with MAX_POCET_SLOV_CLOVEKA from Vzory/SKL_A_DR.H.

   ASCII only, like the rest of src/shim.
*/

#ifndef POKYD_SHIM_TRIDY_H
#define POKYD_SHIM_TRIDY_H

class Typ_slova {
  public:
  WORD pocetslov;

  char *vlastnislovo;

  WORD *id_slova; BYTE *vzor; BYTE *slovnidruh; char **vnoreni; char **predpona;

  BYTE *pad,*osoba,*cislo,*cas,*rod,*zivotnost,*cislopredmetu;
  BYTE *rodpredmetu,*vid,*tvar,*pridavek;
  BYTE *zapor;

  Typ_slova(void);       //konstruktor
  ~Typ_slova(void);       //destruktor
  void VYTVOR_NOVY(WORD kolik);
  void VYMAZ_OBSAH(void);
  void VYMAZ_POSLEDNI_POZICI(void);
  void VYNULUJ_POCET_SLOV(void);
  void NASTAV_POCATECNI_HODNOTY(WORD pozice);
  void PRIPOJ(Typ_slova copripojit);
  void PRIPOJ_JEDEN_VYZNAM(Typ_slova copripojit,WORD poziceslova);
  void VYTAHNI_JEDNO_SLOVO_Z_TYP_SLOVA(Typ_slova puvslova,WORD poziceslova);
  void ZKOPIRUJ_JEDNO_SLOVO_Z_TYP_SLOVA(Typ_slova zdroj,WORD odkud,WORD kam);  //[shim] byl tu "Typ_slova::"
  void ZKOPIRUJ_JEDNO_SLOVO_Z_TYP_SLOVA(WORD odkud,WORD kam);
  void UPRAV_VZOR(BYTE novyvzor,WORD pozice);
 };

class Struktura_vety {
  public:
  WORD pocetslov;

  BYTE typ_vety;
  #define _veta_oznamovaci_ 0
  #define _veta_tazaci_ 1
  #define _veta_rozkazovaci_ 2

  Typ_slova podmet;
  WORD pozicepodmetu;

  Typ_slova prisudek;
  WORD poziceprisudku;

  Typ_slova predmet;
  WORD pozicepredmetu;

  Typ_slova slova[MAX_POCET_SLOV_CLOVEKA];

  void VYNULUJ_HODNOTY(void);
 };

class Nastaveni {
  public:
  BYTE pohlavicloveka;     //0...muz, 1...zena
  BYTE pohlavipocitace;
  char jmenocloveka[101];
  char jmenopocitace[101];
  BYTE charakter;
    //1 - naivni, 2 - klidny, 3 - prumerny, 4 - neduverivy
    //5 - naladovy, 6 - vybusny, 0 - stroj
  BYTE nalada;
    //1 - vyborna, 2 - dobra, 3 - normalni, 4 - spatna, 5 - hrozna

  BYTE ukladatrozhovor;      //0...ne, 1...ano
  BYTE pouzivatzvuky;      //0...ne, 1...ano
  BYTE pouzivatefekty;      //0...ne, 1...ano
  BYTE spisovnacestina;      //0...ne, 1...ano
  BYTE zobrazovatpopisky;      //0...ne, 1...ano

  BYTE debug_rychleukoncovani;      //0...ne, 1...ano
  BYTE debug_tolerancepravopisu;
  BYTE debug_pravopisnarekurze;

  BYTE naladabody;

  BYTE emulovatklavesnici;      //0...neemulovat, 1...ceskou, 2...slovenskou
  BYTE klavesniceqwerty;
  BYTE standardnikurzor;

  BYTE prikaz_readonlymod;
  BYTE prikaz_nezobrazovatpozadi;

  Nastaveni(void);
  ~Nastaveni(void);
  void SPOCITEJ_NALADABODY_Z_NALADY(void);
  void SPOCITEJ_NALADU_PODLE_NALADABODY(void);
  void ZKOPIRUJ_SEM(Nastaveni zdroj);
  void NASTAV_STANDARDNE(void);
 };

#endif
