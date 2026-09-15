// Nastaveni.cpp : implementation file
//

#include "stdafx.h"
#include "IQPokyd.h"
#include "Nastaveni.h"
#include "text.h"

#ifdef _DEBUG
#define new DEBUG_NEW
#undef THIS_FILE
static char THIS_FILE[] = __FILE__;
#endif

/////////////////////////////////////////////////////////////////////////////
// CNastaveni dialog


CNastaveni::CNastaveni(CWnd* pParent /*=NULL*/)
	: CDialog(CNastaveni::IDD, pParent)
{
	//{{AFX_DATA_INIT(CNastaveni)
		// NOTE: the ClassWizard will add member initialization here
	//}}AFX_DATA_INIT
}

CNastaveni::~CNastaveni(void) {
  if (IsWindow(m_hWnd)) DestroyWindow();
 }

void CNastaveni::DoDataExchange(CDataExchange* pDX) {
  CDialog::DoDataExchange(pDX);
	//{{AFX_DATA_MAP(CNastaveni)
		// NOTE: the ClassWizard will add DDX and DDV calls here
	//}}AFX_DATA_MAP
 }

BEGIN_MESSAGE_MAP(CNastaveni, CDialog)
	//{{AFX_MSG_MAP(CNastaveni)
	ON_WM_HELPINFO()
	ON_BN_CLICKED(IDC_ZOBRAZOVATPOPISKY, OnZobrazovatpopisky)
	ON_COMMAND(ID_ZKRATKA_SMAZRADEK, OnClose)
	ON_BN_CLICKED(IDC_POCITACZENA, BublinkovaNapoveda)
	ON_WM_CTLCOLOR()
	ON_BN_CLICKED(IDC_ROZSIRENENASTAVENI, OnRozsireneNastaveni)
	ON_BN_CLICKED(IDC_ZAKLADNINASTAVENI, OnZakladniNastaveni)
	ON_BN_CLICKED(IDC_POCITACMUZ, BublinkovaNapoveda)
	ON_BN_CLICKED(IDC_CLOVEKZENA, BublinkovaNapoveda)
	ON_BN_CLICKED(IDC_CLOVEKMUZ, BublinkovaNapoveda)
	ON_BN_CLICKED(IDC_EMULOVATKLAVESNICI, OnNastavDisableEmulace)
	//}}AFX_MSG_MAP
END_MESSAGE_MAP()

/////////////////////////////////////////////////////////////////////////////
// CNastaveni message handlers

BOOL CNastaveni::OnHelpInfo(HELPINFO* pHelpInfo) {
	return(TRUE);
 }

BOOL CNastaveni::OnInitDialog() {
  CDialog::OnInitDialog();

  if (g_nastaveni.pohlavicloveka == 1) CheckDlgButton(IDC_CLOVEKMUZ,1);
  else CheckDlgButton(IDC_CLOVEKZENA,1);
  if (g_nastaveni.pohlavipocitace == 1) CheckDlgButton(IDC_POCITACMUZ,1);
  else CheckDlgButton(IDC_POCITACZENA,1);

  GetDlgItem(IDC_JMENOCLOVEKA)->SetWindowText(g_nastaveni.jmenocloveka);
  GetDlgItem(IDC_JMENOPOCITACE)->SetWindowText(g_nastaveni.jmenopocitace);

  SendDlgItemMessage(IDC_CHARAKTER,LB_ADDSTRING,0,(LPARAM)"stroj");
  SendDlgItemMessage(IDC_CHARAKTER,LB_ADDSTRING,0,(LPARAM)"naivní");
  SendDlgItemMessage(IDC_CHARAKTER,LB_ADDSTRING,0,(LPARAM)"klidný");
  SendDlgItemMessage(IDC_CHARAKTER,LB_ADDSTRING,0,(LPARAM)"prùmìrný");
  SendDlgItemMessage(IDC_CHARAKTER,LB_ADDSTRING,0,(LPARAM)"nedùvìøivý");
  SendDlgItemMessage(IDC_CHARAKTER,LB_ADDSTRING,0,(LPARAM)"náladový");
  SendDlgItemMessage(IDC_CHARAKTER,LB_ADDSTRING,0,(LPARAM)"výbušný");

  SendDlgItemMessage(IDC_CHARAKTER,LB_SETCURSEL,g_nastaveni.charakter);

  SendDlgItemMessage(IDC_NALADA,LB_ADDSTRING,0,(LPARAM)"výborná");
  SendDlgItemMessage(IDC_NALADA,LB_ADDSTRING,0,(LPARAM)"dobrá");
  SendDlgItemMessage(IDC_NALADA,LB_ADDSTRING,0,(LPARAM)"normální");
  SendDlgItemMessage(IDC_NALADA,LB_ADDSTRING,0,(LPARAM)"špatná");
  SendDlgItemMessage(IDC_NALADA,LB_ADDSTRING,0,(LPARAM)"hrozná");

  SendDlgItemMessage(IDC_NALADA,LB_SETCURSEL,g_nastaveni.nalada-1);

  CheckDlgButton(IDC_UKLADATROZHOVOR,g_nastaveni.ukladatrozhovor);
  CheckDlgButton(IDC_POUZIVATZVUKY,g_nastaveni.pouzivatzvuky);
  CheckDlgButton(IDC_POUZIVATEFEKTY,g_nastaveni.pouzivatefekty);
  CheckDlgButton(IDC_SPISOVNACESTINA,g_nastaveni.spisovnacestina);

  if (g_nastaveni.emulovatklavesnici > 0)
   CheckDlgButton(IDC_EMULOVATKLAVESNICI,1);
  else 
   CheckDlgButton(IDC_EMULOVATKLAVESNICI,0);

  OnNastavDisableEmulace();

  if (g_nastaveni.emulovatklavesnici == 2)
   CheckDlgButton(IDC_EMULOVATSLOVENSKOUKLAVESNICI,1);
  else
   CheckDlgButton(IDC_EMULOVATCESKOUKLAVESNICI,1);

  CheckDlgButton(IDC_KLAVESNICEQWERTY,g_nastaveni.klavesniceqwerty);
  CheckDlgButton(IDC_ZOBRAZOVATSTANDARDNIKURZOR,g_nastaveni.standardnikurzor);
  CheckDlgButton(IDC_NEZOBRAZOVATPOZADI,g_nastaveni.prikaz_nezobrazovatpozadi);
  CheckDlgButton(IDC_READONLYMOD,g_nastaveni.prikaz_readonlymod);
  CheckDlgButton(IDC_ZOBRAZOVATPOPISKY,g_nastaveni.zobrazovatpopisky);
	

  m_oNapoveda.Create(this);
  if (g_nastaveni.zobrazovatpopisky == 1) m_oNapoveda.Activate(TRUE);
  else m_oNapoveda.Activate(FALSE);
  m_oNapoveda.SendMessage(TTM_SETMAXTIPWIDTH,0,450);
  m_oNapoveda.SendMessage(TTM_SETDELAYTIME,TTDT_AUTOPOP,10000);
  m_oNapoveda.SendMessage(TTM_SETDELAYTIME,TTDT_INITIAL,200);
  m_oNapoveda.SendMessage(TTM_SETDELAYTIME,TTDT_RESHOW,0);

  BublinkovaNapoveda();
  
  OnZakladniNastaveni();

  return TRUE;  // return TRUE unless you set the focus to a control
	              // EXCEPTION: OCX Property Pages should return FALSE
 }

BOOL CNastaveni::PreTranslateMessage(MSG* pMsg) {
  m_oNapoveda.RelayEvent(pMsg);
  return CDialog::PreTranslateMessage(pMsg);
 }

void CNastaveni::OnOK() {
BYTE docasnanalada,prekreslipozadi=0;
CEdit* pEdit=NULL;
CString jmeno;

  if (IsDlgButtonChecked(IDC_CLOVEKZENA) == 0) g_nastaveni.pohlavicloveka=1;
  else g_nastaveni.pohlavicloveka=2;
  if (IsDlgButtonChecked(IDC_POCITACZENA) == 0) g_nastaveni.pohlavipocitace=1;
  else g_nastaveni.pohlavipocitace=2;

  pEdit = (CEdit*)GetDlgItem(IDC_JMENOCLOVEKA);
  pEdit->GetWindowText(jmeno);
  if (ZKONTROLUJ_SPRAVNOST_ZNAKU_VE_JMENE(jmeno) == 0) {
    MessageBox("Tvé jméno musí být jednoslovné! Sice si vážím toho, že se mi pøedstavuješ i s pøíjmením, ale pøece jenom je lepší na nìkoho volat jen køestním jménem.","Chyba",MB_ICONWARNING | MB_SYSTEMMODAL);
    pEdit->SetFocus(); return;
   }
  strncpy(g_nastaveni.jmenocloveka,jmeno,MAX_DELKA_JMENA);
  g_nastaveni.jmenocloveka[MAX_DELKA_JMENA]=0;

  pEdit = (CEdit*)GetDlgItem(IDC_JMENOPOCITACE);
  pEdit->GetWindowText(jmeno);
  if (ZKONTROLUJ_SPRAVNOST_ZNAKU_VE_JMENE(jmeno) == 0) {
    MessageBox("Mé jméno musí být jednoslovné! Nepotøebuji nìjaké dlouhé jméno; staèí mi jen to køestní.","Chyba",MB_ICONWARNING | MB_SYSTEMMODAL);
    pEdit->SetFocus(); return;
   }
  strncpy(g_nastaveni.jmenopocitace,jmeno,MAX_DELKA_JMENA);
  g_nastaveni.jmenopocitace[MAX_DELKA_JMENA]=0;
  
  g_nastaveni.charakter=(BYTE)SendDlgItemMessage(IDC_CHARAKTER,LB_GETCURSEL,0,0);

  docasnanalada=(BYTE)SendDlgItemMessage(IDC_NALADA,LB_GETCURSEL,0,0)+1;
  if (docasnanalada != g_nastaveni.nalada) {
    g_nastaveni.nalada=docasnanalada; g_nastaveni.SPOCITEJ_NALADABODY_Z_NALADY();
   }

  if (IsDlgButtonChecked(IDC_UKLADATROZHOVOR) == 0) g_nastaveni.ukladatrozhovor=0;
  else g_nastaveni.ukladatrozhovor=1;
  if (IsDlgButtonChecked(IDC_POUZIVATZVUKY) == 0) g_nastaveni.pouzivatzvuky=0;
  else g_nastaveni.pouzivatzvuky=1;
  if (IsDlgButtonChecked(IDC_POUZIVATEFEKTY) == 0) g_nastaveni.pouzivatefekty=0;
  else g_nastaveni.pouzivatefekty=1;
  if (IsDlgButtonChecked(IDC_SPISOVNACESTINA) == 0) g_nastaveni.spisovnacestina=0;
  else g_nastaveni.spisovnacestina=1;

  if (IsDlgButtonChecked(IDC_EMULOVATKLAVESNICI) != 0) {
    if (IsDlgButtonChecked(IDC_EMULOVATCESKOUKLAVESNICI) == 0) g_nastaveni.emulovatklavesnici=2;
    else g_nastaveni.emulovatklavesnici=1;
   }
  else g_nastaveni.emulovatklavesnici=0;
  if (IsDlgButtonChecked(IDC_KLAVESNICEQWERTY) == 0) g_nastaveni.klavesniceqwerty=0;
  else g_nastaveni.klavesniceqwerty=1;
  if (IsDlgButtonChecked(IDC_ZOBRAZOVATSTANDARDNIKURZOR) == 0) g_nastaveni.standardnikurzor=0;
  else g_nastaveni.standardnikurzor=1;
  if (IsDlgButtonChecked(IDC_NEZOBRAZOVATPOZADI) == 0) {
    if (g_nastaveni.prikaz_nezobrazovatpozadi == 1) {
      prekreslipozadi=1; g_nastaveni.prikaz_nezobrazovatpozadi=0;
     }
   }
  else {
    if (g_nastaveni.prikaz_nezobrazovatpozadi == 0) {
      prekreslipozadi=1; g_nastaveni.prikaz_nezobrazovatpozadi=1;
     }
   }
  if (IsDlgButtonChecked(IDC_READONLYMOD) == 0) g_nastaveni.prikaz_readonlymod=0;
  else g_nastaveni.prikaz_readonlymod=1;

  if (IsDlgButtonChecked(IDC_ZOBRAZOVATPOPISKY) == 0) g_nastaveni.zobrazovatpopisky=0;
  else g_nastaveni.zobrazovatpopisky=1;

  ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI();
  NASTAV_VIDITELNOST_EFEKTNICH_PROGRESSBARU();
  if (prekreslipozadi == 1) NASTAV_VIDITELNOST_POZADI(1);
  ZAPIS_NASTAVENI_DO_SOUBORU(g_nastaveni);

  if (g_nastaveni.pouzivatzvuky == 0) PlaySound(NULL, g_instanceprogramu, SND_PURGE);

  CDialog::OnOK();
 }

void CNastaveni::OnZobrazovatpopisky() {
  if (IsDlgButtonChecked(IDC_ZOBRAZOVATPOPISKY) == 0) m_oNapoveda.Activate(FALSE);
  else m_oNapoveda.Activate(TRUE);
 }

void CNastaveni::OnClose() {
  SendMessage(WM_CLOSE);
 }

void CNastaveni::BublinkovaNapoveda() {
static BYTE pohlavicloveka=0,pohlavipocitace=0;

  if (IsDlgButtonChecked(IDC_CLOVEKZENA) == 0) {     //pro mužské pohlaví
    if (pohlavicloveka == 2) {
      GetDlgItem(IDC_JMENOCLOVEKA)->SetFocus();
       //pokud se zmìní pohlaví, je tøeba dát focus i pro zmìnu jména
      SendDlgItemMessage(IDC_JMENOCLOVEKA,EM_SETSEL,0,-1);
     }                            //"nasvícení" jména
    pohlavicloveka=1;
   }
  else {     //pro ženské pohlaví
    if (pohlavicloveka == 1) {
      GetDlgItem(IDC_JMENOCLOVEKA)->SetFocus();
       //pokud se zmìní pohlaví, je tøeba dát focus i pro zmìnu jména
      SendDlgItemMessage(IDC_JMENOCLOVEKA,EM_SETSEL,0,-1);
     }                            //"nasvícení" jména
    pohlavicloveka=2;
   }

  if (IsDlgButtonChecked(IDC_POCITACZENA) == 0) {     //pro mužské pohlaví
    if (pohlavipocitace == 2) {
      GetDlgItem(IDC_JMENOPOCITACE)->SetFocus();
       //pokud se zmìní pohlaví, je tøeba dát focus i pro zmìnu jména
      SendDlgItemMessage(IDC_JMENOPOCITACE,EM_SETSEL,0,-1);
     }                            //"nasvícení" jména
    pohlavipocitace=1;
   }
  else {     //pro ženské pohlaví
    if (pohlavipocitace == 1) {
      GetDlgItem(IDC_JMENOPOCITACE)->SetFocus();
       //pokud se zmìní pohlaví, je tøeba dát focus i pro zmìnu jména
      SendDlgItemMessage(IDC_JMENOPOCITACE,EM_SETSEL,0,-1);
     }                            //"nasvícení" jména
    pohlavipocitace=2;
   }

//  m_oNapoveda.AddTool(GetDlgItem(IDC_CLOVEKPOHLAVI),"Zde si urèíš, jaké máš pohlaví (ne že by ses musel(a) pøeoperovat :-) )");
  m_oNapoveda.AddTool(GetDlgItem(IDC_CLOVEKZENA),"Ty (tedy èlovìk) jsi ženského pohlaví");
  m_oNapoveda.AddTool(GetDlgItem(IDC_CLOVEKMUZ),"Ty (tedy èlovìk) jsi mužského pohlaví");
//  m_oNapoveda.AddTool(GetDlgItem(IDC_POCITACPOHLAVI),"Zde urèíš, jestli mám být já muž nebo žena");
  m_oNapoveda.AddTool(GetDlgItem(IDC_POCITACZENA),"Já (tedy poèítaè) budu žena");
  m_oNapoveda.AddTool(GetDlgItem(IDC_POCITACMUZ),"Já (tedy poèítaè) budu chlap");
  m_oNapoveda.AddTool(GetDlgItem(IDC_JMENOPOCITACE),"Sem napiš, jak se mám jmenovat já (tedy poèítaè). Jméno nemá zásadní vliv na chod programu");

  if (pohlavipocitace == 1) {     //pro mužské pohlaví
    m_oNapoveda.AddTool(GetDlgItem(IDC_JMENOCLOVEKA),"Sem napiš, jak se jmenuješ a jak bych tì tedy mìl oslovovat. Jméno nemá zásadní vliv na chod programu");
    m_oNapoveda.AddTool(GetDlgItem(IDC_CHARAKTER),"Podle toho, jaký mám charakter, reaguji na hovor a podle toho také mìním náladu. Pokud nastavíš jako charakter \"stroj\", budu poøád stejný, tedy náladu mìnit sám nebudu.");
    m_oNapoveda.AddTool(GetDlgItem(IDC_NALADA),"Nálada ovlivòuje moje chování a podle ní se také chovám. Pozor, náladu sám mìním, ale jakým zpùsobem, to udává mùj charakter.");
   }
  else {     //pro ženské pohlaví
    m_oNapoveda.AddTool(GetDlgItem(IDC_JMENOCLOVEKA),"Sem napiš, jak se jmenuješ a jak bych tì tedy mìla oslovovat. Jméno nemá zásadní vliv na chod programu");
    m_oNapoveda.AddTool(GetDlgItem(IDC_CHARAKTER),"Podle toho, jaký mám charakter, reaguji na hovor a podle toho také mìním náladu. Pokud nastavíš jako charakter \"stroj\", budu poøád stejná, tedy náladu mìnit sama nebudu.");
    m_oNapoveda.AddTool(GetDlgItem(IDC_NALADA),"Nálada ovlivòuje moje chování a podle ní se také chovám. Pozor, náladu sama mìním, ale jakým zpùsobem, to udává mùj charakter.");
   }
  m_oNapoveda.AddTool(GetDlgItem(IDC_UKLADATROZHOVOR),"Zapsat celý rozhovor pøi ukonèení programu do souboru "JMENO_SOUBORU_S_TEXTOVYMI_ZAZNAMY" v adresáøi s IQ Pokydem");

  if (g_tuknuti.aktualnipocetzvuku > 0)
   m_oNapoveda.AddTool(GetDlgItem(IDC_POUZIVATZVUKY),"Má-li program používat nìjaké zvuky, nebo tì tak drásají, že je mám radìji vypnout.");
  else m_oNapoveda.AddTool(GetDlgItem(IDC_POUZIVATZVUKY),"NA TÉTO HODNOTÌ MOMENTÁLNÌ VÙBEC NEZÁLEŽÍ, PROTOŽE SOUBOR \"TUKNUTI.WAV\" CHYBÍ. PROSÍM NAHRAJ HO K PROGRAMU, DO TÉ DOBY NEMÙŽU ŽÁDNÉ ZVUKY VYDÁVAT.\nNebo máš ještì jinou možnost: zkopíruj jako \"tuknuti.wav\" nìjaký vlastní krátký WAVE soubor. Pokud to bude standardní .wav (hlavièka 44 bajtù), 8bitový, mono, budu ho používat v rùzných frekvencích.");

  m_oNapoveda.AddTool(GetDlgItem(IDC_POUZIVATEFEKTY),"Mám-li používat pøi bìhu programu rùzné grafické efekty (konkrétnì dva progress bary po stranách).");
  m_oNapoveda.AddTool(GetDlgItem(IDC_SPISOVNACESTINA),"Má-li se dávat pøednost spisovné èeštinì pøed hovorovou èeštinou.\nZatrhnutí tohoto tlaèítka neznamená úplnou spisovnost programu, ale bude \"o tøídu\" spisovnìjší. Vzhledem k mému celkovému hovorovému zpùsobu vyjadøování tak ale mùžou vzniknout bizardní konstrukce, které by nikdo normální neøekl.\nV opaèném pøípadì budu používat spíše hovorovou èeštinu.");

  m_oNapoveda.AddTool(GetDlgItem(IDC_EMULOVATKLAVESNICI),"Pøi zaškrnutí této volby se bude program chovat, jako kdyby byla na poèítaèi nainstalována a aktivní èeská (slovenská) klávesnice. Tedy místo èísel budou znaky s diakritikou, budou i jinak nìkteré speciální znaky (otazník, vykøièník atd.).\nEmulace se týká i základních písmen bez diakritiky (které u nìkterých exotiètìjších jazykù mùžou být zpøeházené).");
  m_oNapoveda.AddTool(GetDlgItem(IDC_EMULOVATCESKOUKLAVESNICI),"Emulovat standardní èeskou klávesnici.\nPokud nechceš prohazovat písmena Y a Z, zaškrtni i volbu \"QWERTY\".");
  m_oNapoveda.AddTool(GetDlgItem(IDC_EMULOVATSLOVENSKOUKLAVESNICI),"Emulovat standardní slovenskou klávesnici. Je vylepšená (po vzoru èeské klávesnice) o automatické psaní velkých písmen i s diakritikou pøi zapnutém CapsLocku.\nPokud nechceš prohazovat písmena Y a Z, zaškrtni i volbu \"QWERTY\".");
  m_oNapoveda.AddTool(GetDlgItem(IDC_KLAVESNICEQWERTY),"Chceš-li uspoøádání základní klávesnice tak, jako je na anglické klávesnici (tedy první øada zaèíná Q, W, E, R, T, Y), zaškrtni tuto volbu. Chceš-li oproti anglické klávesnici prohodit písmena Z a Y (tedy první øada bude zaèínat Q, W, E, R, T, Z), nech tuto volbu nezaškrtnutou.\nStandardní uspoøádání èeské i slovenské klávesnice je QWERTZ (tedy nezaškrtlé).");
  m_oNapoveda.AddTool(GetDlgItem(IDC_ZOBRAZOVATSTANDARDNIKURZOR),"Má-li se zobrazovat standardní kurzor používaný v textových políèkách ve Windows, tedy svislá èárka (|).\nPøi nezaškrtnutí tohoto políèka se použije kurzor známý z DOSu ve tvaru podtržítka (_).");
  m_oNapoveda.AddTool(GetDlgItem(IDC_NEZOBRAZOVATPOZADI),"Mám-li nebo nemám zobrazovat pozadí okna a políèek, do kterých se píše.\nTuto volbu zaškrtni, když:\n1) Píšeš žlutým písmem na bílém pozadí\n2) Pozadí samotných oken je jen zmì barev a není pøes to poøádnì vidìt\nTato volba je vlastnì korekcí nedoøešených problémù programu. V prùbìhu pøíštích verzí by se mìly tyto problémy (snad) vyøešit a tato volba potom zmizí.\n\nPozn.: Tato volba lze také zapnout už pøi spuštìní programu. Spus program z pøíkazového øádku parametrem \"-bezpozadi\", tedy \"IQPokyd.exe -bezpozadi\".");
  if (pohlavipocitace == 1) {     //pro mužské pohlaví
    m_oNapoveda.AddTool(GetDlgItem(IDC_READONLYMOD),"Pokud z nìjakého dùvodu nechceš, abych cokoli zapisoval na disk (pojmem \"na disk\" rozumìj do toho adresáøe, kde jsem já sám), pak zaškrtni tuto volbu. V praxi to využiješ napø. když mì budeš chtít spouštìt z CD atd. (ovšem tuto volbu musíš zaškrtnout ještì pøedtím, než mì vypálíš, nastavení taky ukládám k sobì do adresáøe!).\n\nPozn.: Tato volba lze také zapnout už pøi spuštìní programu. Spus program z pøíkazového øádku parametrem \"-readonly\", tedy \"IQPokyd.exe -readonly\".");
   }
  else {     //pro ženské pohlaví
    m_oNapoveda.AddTool(GetDlgItem(IDC_READONLYMOD),"Pokud z nìjakého dùvodu nechceš, abych cokoli zapisoval na disk (pojmem \"na disk\" rozumìj do toho adresáøe, kde jsem já sama), pak zaškrtni tuto volbu. V praxi to využiješ napø. když mì budeš chtít spouštìt z CD atd. (ovšem tuto volbu musíš zaškrtnout ještì pøedtím, než mì vypálíš, nastavení taky ukládám k sobì do adresáøe!).\n\nPozn.: Tato volba lze také zapnout už pøi spuštìní programu. Spus program z pøíkazového øádku parametrem \"-readonly\", tedy \"IQPokyd.exe -readonly\".");
   }
  m_oNapoveda.AddTool(GetDlgItem(IDC_ZOBRAZOVATPOPISKY),"");

  m_oNapoveda.AddTool(GetDlgItem(IDC_ZOBRAZOVATPOPISKY),"Má-li se zobrazovat tato bublinková nápovìda...");
  m_oNapoveda.AddTool(GetDlgItem(IDOK),"Potvrdit nastavení a uložit");
  m_oNapoveda.AddTool(GetDlgItem(IDCANCEL),"Radši nechat pùvodní nastavení");
 }

HBRUSH CNastaveni::OnCtlColor(CDC* pDC, CWnd* pWnd, UINT nCtlColor) {
  pDC->SetBkMode(TRANSPARENT);
  if (nCtlColor == CTLCOLOR_EDIT || nCtlColor == CTLCOLOR_LISTBOX) {
    return CDialog::OnCtlColor(pDC,pWnd,nCtlColor); 
   }
  return g_stetecpozadipodokna;
 }

void ZOBRAZ_NA_DIALOGU_POLICKO(CWnd *policko,BYTE zobraz) {
   //zobrazi (zobraz=1) nebo skryje (zobraz=0) policko,
   //a to vcetne klavesove asociace.
int pozice;
char *text=ALOKUJ_RETEZEC(1001);

  switch(zobraz) {
    case 0: policko->ShowWindow(SW_HIDE); break;
    case 1: policko->ShowWindow(SW_SHOW); break;
    default: NAHLAS_CHYBU(__FILE__,__LINE__,_NESPECIFIKOVANO_,_UKONCIT_);
   }

  policko->GetWindowText(text,1000);
  for (pozice=0; text[pozice] != 0; pozice++) {
    if (pozice == 1000) NAHLAS_CHYBU(__FILE__,__LINE__,_NESPECIFIKOVANO_,_UKONCIT_);
    if (text[pozice] == '~' && zobraz == 1) text[pozice]='&';
    if (text[pozice] == '&' && zobraz == 0) text[pozice]='~';
   }
  policko->SetWindowText(text);

  UVOLNI(text);
 }

void CNastaveni::OnZakladniNastaveni() {
  SetFocus();

/*  CTabCtrl *zalozky;
  zalozky=(CTabCtrl *)GetDlgItem(IDC_ZALOZKY);
  zalozky->InsertItem(0,"Základní nastavení");
  zalozky->InsertItem(1,"Rozšíøené nastavení");*/

  ((CButton *)GetDlgItem(IDC_ZAKLADNINASTAVENI))->SetState(TRUE);
  ((CButton *)GetDlgItem(IDC_ROZSIRENENASTAVENI))->SetState(FALSE);

  GetDlgItem(IDC_RAMECEK1)->SetWindowText("Naše charakteristiky");
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_CLOVEKPOHLAVI),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_POCITACPOHLAVI),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_CLOVEKZENA),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_POCITACZENA),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_CLOVEKMUZ),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_POCITACMUZ),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_JMENOCLOVEKASTATIC),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_JMENOPOCITACESTATIC),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_JMENOCLOVEKA),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_JMENOPOCITACE),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_CHARAKTERSTATIC),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_NALADASTATIC),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_CHARAKTER),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_NALADA),1);

  GetDlgItem(IDC_RAMECEK2)->SetWindowText("Prostøedí");
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_UKLADATROZHOVOR),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_POUZIVATZVUKY),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_POUZIVATEFEKTY),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_SPISOVNACESTINA),1);

  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_EMULOVATKLAVESNICI),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_EMULOVATCESKOUKLAVESNICI),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_EMULOVATSLOVENSKOUKLAVESNICI),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_KLAVESNICEQWERTY),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_TEXTKEMULACI),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_ZOBRAZOVATSTANDARDNIKURZOR),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_NEZOBRAZOVATPOZADI),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_READONLYMOD),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_ZOBRAZOVATPOPISKY),0);
 }

void CNastaveni::OnRozsireneNastaveni() {
  SetFocus();

/*  CTabCtrl *zalozky;
  zalozky=(CTabCtrl *)GetDlgItem(IDC_ZALOZKY);
  zalozky->InsertItem(0,"Základní nastavení");
  zalozky->InsertItem(1,"Rozšíøené nastavení");
*/

  ((CButton *)GetDlgItem(IDC_ZAKLADNINASTAVENI))->SetState(FALSE);
  ((CButton *)GetDlgItem(IDC_ROZSIRENENASTAVENI))->SetState(TRUE);

  GetDlgItem(IDC_RAMECEK1)->SetWindowText("Emulace prostøedí");
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_CLOVEKPOHLAVI),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_POCITACPOHLAVI),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_CLOVEKZENA),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_POCITACZENA),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_CLOVEKMUZ),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_POCITACMUZ),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_JMENOCLOVEKASTATIC),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_JMENOPOCITACESTATIC),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_JMENOCLOVEKA),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_JMENOPOCITACE),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_CHARAKTERSTATIC),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_NALADASTATIC),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_CHARAKTER),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_NALADA),0);

  GetDlgItem(IDC_RAMECEK2)->SetWindowText("Jiná nastavení");
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_UKLADATROZHOVOR),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_POUZIVATZVUKY),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_POUZIVATEFEKTY),0);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_SPISOVNACESTINA),0);

  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_EMULOVATKLAVESNICI),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_EMULOVATCESKOUKLAVESNICI),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_EMULOVATSLOVENSKOUKLAVESNICI),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_KLAVESNICEQWERTY),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_TEXTKEMULACI),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_ZOBRAZOVATSTANDARDNIKURZOR),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_NEZOBRAZOVATPOZADI),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_READONLYMOD),1);
  ZOBRAZ_NA_DIALOGU_POLICKO(GetDlgItem(IDC_ZOBRAZOVATPOPISKY),1);
 }

void CNastaveni::OnNastavDisableEmulace() {
  if (IsDlgButtonChecked(IDC_EMULOVATKLAVESNICI) == 1) {
    GetDlgItem(IDC_EMULOVATCESKOUKLAVESNICI)->EnableWindow(TRUE);
    GetDlgItem(IDC_EMULOVATSLOVENSKOUKLAVESNICI)->EnableWindow(TRUE);
    GetDlgItem(IDC_KLAVESNICEQWERTY)->EnableWindow(TRUE);
   }
  else {
    GetDlgItem(IDC_EMULOVATCESKOUKLAVESNICI)->EnableWindow(FALSE);
    GetDlgItem(IDC_EMULOVATSLOVENSKOUKLAVESNICI)->EnableWindow(FALSE);
    GetDlgItem(IDC_KLAVESNICEQWERTY)->EnableWindow(FALSE);
   }
 }

