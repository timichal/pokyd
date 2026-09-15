
class CDebugNastaveni : public CDialog
{
	CToolTipCtrl m_oNapoveda;
public:
// Construction
	CDebugNastaveni(CWnd* pParent = NULL);   // standard constructor
  ~CDebugNastaveni(void);

// Dialog Data
	//{{AFX_DATA(CDebugNastaveni)
	enum { IDD = IDD_DEBUGNASTAVENI };
		// NOTE: the ClassWizard will add data members here
	//}}AFX_DATA


// Overrides
	// ClassWizard generated virtual function overrides
	//{{AFX_VIRTUAL(CDebugNastaveni)
	protected:
    virtual BOOL PreTranslateMessage(MSG* pMsg);
	virtual void DoDataExchange(CDataExchange* pDX);    // DDX/DDV support
	//}}AFX_VIRTUAL

// Implementation
protected:

	// Generated message map functions
	//{{AFX_MSG(CDebugNastaveni)
	afx_msg BOOL OnHelpInfo(HELPINFO* pHelpInfo);
	virtual BOOL OnInitDialog();
	virtual void OnOK();
	afx_msg void OnClose();
	afx_msg void BublinkovaNapoveda();
	//}}AFX_MSG
	DECLARE_MESSAGE_MAP()
};


CDebugNastaveni::CDebugNastaveni(CWnd* pParent /*=NULL*/)
	: CDialog(CDebugNastaveni::IDD, pParent)
{
	//{{AFX_DATA_INIT(CDebugNastaveni)
		// NOTE: the ClassWizard will add member initialization here
	//}}AFX_DATA_INIT
}

CDebugNastaveni::~CDebugNastaveni(void) {
  if (IsWindow(m_hWnd)) DestroyWindow();
 }

void CDebugNastaveni::DoDataExchange(CDataExchange* pDX)
{
	CDialog::DoDataExchange(pDX);
	//{{AFX_DATA_MAP(CDebugNastaveni)
		// NOTE: the ClassWizard will add DDX and DDV calls here
	//}}AFX_DATA_MAP
}


BEGIN_MESSAGE_MAP(CDebugNastaveni, CDialog)
	//{{AFX_MSG_MAP(CDebugNastaveni)
	ON_WM_HELPINFO()
	ON_COMMAND(ID_ZKRATKA_SMAZRADEK, OnClose)
	//}}AFX_MSG_MAP
END_MESSAGE_MAP()

/////////////////////////////////////////////////////////////////////////////
// CDebugNastaveni message handlers

BOOL CDebugNastaveni::OnHelpInfo(HELPINFO* pHelpInfo) {
	return(TRUE);
 }

BOOL CDebugNastaveni::OnInitDialog() {
char *hlaska=NULL,*docasne=NULL,*docasnahlaska=NULL;
CEdit* pEdit;

  CDialog::OnInitDialog();

  hlaska=ALOKUJ_RETEZEC(5000);
  docasnahlaska=ALOKUJ_RETEZEC(5000);
  docasne=ALOKUJ_RETEZEC(200);

  switch(g_nastaveni.nalada) {
    case 1: strcpy(docasne,"vıborná"); break;
    case 2: strcpy(docasne,"dobrá"); break;
    case 3: strcpy(docasne,"normální"); break;
    case 4: strcpy(docasne,"špatná"); break;
    case 5: strcpy(docasne,"hrozná"); break;
    default: strcpy(docasne,"CHYBNÉ ÈÍSLO!"); break;
   }

  sprintf(hlaska,""
  "-------------------------------  PAMÌ  ------------------------------\r\n"
  "   Poèet alokovanıch blokù: %lu\r\n"
  "   Minimální poèet slov: %lu\r\n"
  "--------------------------  UIVATELSKÉ  ------------------------\r\n"
  "   Aktuální nálada poèítaèe: %d (%s)\r\n"
  "   Poslední odpovìï poèítaèe:\r\n %s\r\n"
  "   Poèet alternativ odpovìdí: %lu\r\n"
  "   Poslední vìta èlovìka: %s\r\n",
    debug_pocetalokovani,debug_maxpocetvsechslov,
    g_nastaveni.naladabody,docasne,g_odpovedpocitace,
    g_pocetodpovedipocitace,g_predchozivetacloveka);

  strcpy(docasne,debug_poslednipodmetcloveka);
  ODUPRAV_SLOVO_PRO_IQPOKYD(docasne);
  sprintf(docasnahlaska,"     Podmìt: %s\r\n",docasne);
  strcat(hlaska,docasnahlaska);

  strcpy(docasne,debug_posledniprisudekcloveka);
  ODUPRAV_SLOVO_PRO_IQPOKYD(docasne);
  sprintf(docasnahlaska,"     Pøísudek: %s\r\n",docasne);
  strcat(hlaska,docasnahlaska);

  strcpy(docasne,debug_poslednipredmetcloveka);
  ODUPRAV_SLOVO_PRO_IQPOKYD(docasne);
  sprintf(docasnahlaska,"     Pøedmìt: %s\r\n",docasne);
  strcat(hlaska,docasnahlaska);

  sprintf(docasnahlaska,
  "----------------------------  SLOVNÍKY  ----------------------------\r\n"
  "   Slov v \"základní\" databázi: %lu\r\n"
  "   Podmínek databáze odpovìdí: %lu",
    g_pocetslovvzakladnidatabazi,
    g_pocetiqpodminek);
  strcat(hlaska,docasnahlaska);

  if (g_nastaveni.zobrazovatpopisky == 0)  //nápovìda pøi vypnutıch popiscích
   strcat(hlaska,"\r\n\r\nPozn.: Pokud chceš nápovìdu k jednotlivım polokám vpravo, povol v \"normálním\" nastavení zobrazování popiskù funkcí.");

  pEdit = (CEdit*)GetDlgItem(IDC_HODNOTY);
  pEdit->SetWindowText(hlaska);


  sprintf(hlaska,"%d",g_nastaveni.naladabody);
  pEdit = (CEdit*)GetDlgItem(IDC_NALADABODY);
  pEdit->SetWindowText(hlaska);

  UVOLNI(docasne);
  UVOLNI(docasnahlaska);
  UVOLNI(hlaska);

  CheckDlgButton(IDC_RYCHLEUKONCOVANI,g_nastaveni.debug_rychleukoncovani);

  switch(g_nastaveni.debug_tolerancepravopisu) {
    case 0: CheckDlgButton(IDC_ZADNATOLERANCEPRAVOPISU,1); break;
    case 1: CheckDlgButton(IDC_UPLNATOLERANCEPRAVOPISU,1); break;
    default: NAHLAS_CHYBU(__FILE__,__LINE__,_NESPECIFIKOVANO_,_UKONCIT_);
   }
  switch(g_nastaveni.debug_pravopisnarekurze) {
    case 0: CheckDlgButton(IDC_ZADNAREKURZEPROHLEDAVANI,1); break;
    case 7: CheckDlgButton(IDC_MALAREKURZEPROHLEDAVANI,1); break;
    case 11: CheckDlgButton(IDC_STREDNIREKURZEPROHLEDAVANI,1); break;
    case 15: CheckDlgButton(IDC_VELKAREKURZEPROHLEDAVANI,1); break;
    case 100: CheckDlgButton(IDC_MAXIMALNIREKURZEPROHLEDAVANI,1); break;
    default: NAHLAS_CHYBU(__FILE__,__LINE__,_NESPECIFIKOVANO_,_UKONCIT_);
   }


  m_oNapoveda.Create(this);
  if (g_nastaveni.zobrazovatpopisky == 1) m_oNapoveda.Activate(TRUE);
  else m_oNapoveda.Activate(FALSE);
  m_oNapoveda.SendMessage(TTM_SETMAXTIPWIDTH,0,450);
  m_oNapoveda.SendMessage(TTM_SETDELAYTIME,TTDT_AUTOPOP,20000);
  m_oNapoveda.SendMessage(TTM_SETDELAYTIME,TTDT_INITIAL,200);
  m_oNapoveda.SendMessage(TTM_SETDELAYTIME,TTDT_RESHOW,0);

  BublinkovaNapoveda();
  
  return TRUE;  // return TRUE unless you set the focus to a control
	              // EXCEPTION: OCX Property Pages should return FALSE
 }

BOOL CDebugNastaveni::PreTranslateMessage(MSG* pMsg) {
  m_oNapoveda.RelayEvent(pMsg);
  return CDialog::PreTranslateMessage(pMsg);
 }

void CDebugNastaveni::OnOK() {
BYTE noveukoncovani,novatolerance,novarekurze,novanaladabody,ulozeni=0;
WORD pozice;
char *naladabodyedit=ALOKUJ_RETEZEC(11);
CString koncovkapohlavi;
CEdit *pEdit;

  if (g_nastaveni.pohlavicloveka == 2) koncovkapohlavi='á';
  else koncovkapohlavi='ı';

  pEdit = (CEdit*)GetDlgItem(IDC_NALADABODY);
  pEdit->GetWindowText(naladabodyedit,10); naladabodyedit[10]=0;
  novanaladabody=0;
  for (pozice=0; pozice < strlen(naladabodyedit); pozice++) {
    if (naladabodyedit[pozice] < '0' || naladabodyedit[pozice] > '9') {
      MessageBox("Pøesná nálada musí bıt celé kladné èíslo!","Chyba",MB_ICONWARNING | MB_SYSTEMMODAL);
      pEdit->SetFocus(); UVOLNI(naladabodyedit); return;
     }
    if (novanaladabody > 25) goto MIMOROZSAH;
  // 25*10 + treba 9 je 259 a to je vetsi nez 255 a o dost vetsi nex maximalnich 90

    novanaladabody*=10;
    novanaladabody+=naladabodyedit[pozice]-'0';
   }
  if (novanaladabody > 90) {
MIMOROZSAH:
    MessageBox("Pøesná nálada musí bıt èíslo v rozmezí 0 - 90!","Chyba",MB_ICONWARNING | MB_SYSTEMMODAL);
    pEdit->SetFocus(); UVOLNI(naladabodyedit); return;
   }
  UVOLNI(naladabodyedit);

  if (IsDlgButtonChecked(IDC_RYCHLEUKONCOVANI) != 0) noveukoncovani=1;
  else noveukoncovani=0;

  if (IsDlgButtonChecked(IDC_ZADNATOLERANCEPRAVOPISU) != 0) novatolerance=0;
  if (IsDlgButtonChecked(IDC_UPLNATOLERANCEPRAVOPISU) != 0) novatolerance=1;

  if (IsDlgButtonChecked(IDC_ZADNAREKURZEPROHLEDAVANI) != 0) novarekurze=0;
  if (IsDlgButtonChecked(IDC_MALAREKURZEPROHLEDAVANI) != 0) novarekurze=7;
  if (IsDlgButtonChecked(IDC_STREDNIREKURZEPROHLEDAVANI) != 0) novarekurze=11;
  if (IsDlgButtonChecked(IDC_VELKAREKURZEPROHLEDAVANI) != 0) novarekurze=15;
  if (IsDlgButtonChecked(IDC_MAXIMALNIREKURZEPROHLEDAVANI) != 0) novarekurze=100;

  if (g_nastaveni.debug_rychleukoncovani != noveukoncovani
   || g_nastaveni.debug_tolerancepravopisu != novatolerance
   || g_nastaveni.debug_pravopisnarekurze != novarekurze) { //pokud je zmena

    if (MessageBox("Zmìna nastavení mùe mít nechtìné následky.\nJsi si jist"+koncovkapohlavi+", e chceš nové parametry uloit?","Upozornìní",MB_OKCANCEL | MB_ICONWARNING | MB_SYSTEMMODAL) != IDOK) return;

    g_nastaveni.debug_rychleukoncovani=noveukoncovani;
    g_nastaveni.debug_tolerancepravopisu=novatolerance;
    g_nastaveni.debug_pravopisnarekurze=novarekurze;
    ulozeni=1;
   }
  if (g_nastaveni.naladabody != novanaladabody) {
    g_nastaveni.naladabody=novanaladabody;
    g_nastaveni.SPOCITEJ_NALADU_PODLE_NALADABODY();
    ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI();
    ulozeni=1;
   }

  if (ulozeni == 1) ZAPIS_NASTAVENI_DO_SOUBORU(g_nastaveni);


  CDialog::OnOK();
 }

void CDebugNastaveni::OnClose() {
  SendMessage(WM_CLOSE);
 }

void CDebugNastaveni::BublinkovaNapoveda() {
CString koncovkapohlavi;
  if (g_nastaveni.pohlavicloveka == 2) koncovkapohlavi='á';
  else koncovkapohlavi='ı';

  m_oNapoveda.AddTool(GetDlgItem(IDC_HODNOTY),"Zde jsou napsané rùzné stavové promìnné programu (platné v okamiku spuštìní tohoto dialogu).");
  m_oNapoveda.AddTool(GetDlgItem(IDC_NALADABODY),"Èíslo, které udává, jakou mám teï momentálnì náladu. Toto èíslo mùe bıt v rozmezí 0 - 90. Jednotlivé \"viditelné\" nálady jsou potom tyto:\n0 - 29 - vıborná\n30 - 44 - dobrá\n45 - 59 - normální\n60 - 74 - špatná\n75 - 90 - hrozná\nToto èíslo se neukládá, ukládá se pouze \"viditelná\" nálada a toto èíslo se potom pøi spuštìní pøiblinì vypoèítá z ní.\nPokud toto èíslo teï zmìníš, mùe se tím samozøejmì zmìnit i ona \"viditelná\" nálada.");
  m_oNapoveda.AddTool(GetDlgItem(IDC_RYCHLEUKONCOVANI),"Udává, má-li se program ukonèovat bez uvolòování pamìti. Tu by mìl uvolnit i samotnı operaèní systém, ale na nìkterıch starších systémech tím dochází k úniku pamìti. Pokud podstoupíš riziko, e se mùe pamì \"zahlcovat\", rychlé ukonèování si mùeš dovolit.\r\n<STANDARDNÌ:  NE>");
  m_oNapoveda.AddTool(GetDlgItem(IDC_ZADNATOLERANCEPRAVOPISU),"Nastavovat ádnou toleranci pravopisu se nedoporuèuje, jsi-li si však jist"+koncovkapohlavi+", e pravopis zvládáš, zpøesní to detekci vìty a v koneèném dùsledku i zkvalitní rozhovor.");
  m_oNapoveda.AddTool(GetDlgItem(IDC_UPLNATOLERANCEPRAVOPISU),"<STANDARDNÌ>\nÚplná tolerance pravopisu znamená, e dává pravopisnì špatnım slovùm (témìø) stejnou váhu jako správnım. Napø.: \"cizinec\" má stejnou váhu jako \"cyzinec\", nezávisle na tom, e u druhého slova se musí zmìnit 1 hláska, aby slovo mìlo smysl.\nVìtší \"citlivost\" v detekci pravopisu bude zahrnuta v pøíštích verzích.");
  m_oNapoveda.AddTool(GetDlgItem(IDC_ZADNAREKURZEPROHLEDAVANI),"Pokud nastavíš ádnou rekurzi, nebudou se jednak prohledávat pøípadné pravopisné chyby, ale také se nebudou prohledávat slova, která s pravopisem nesouvisí!\nNapøíklad \"staiv\" a \"statyv\". Nedoporuèuje se.");
  m_oNapoveda.AddTool(GetDlgItem(IDC_MALAREKURZEPROHLEDAVANI),"Zde se prohledává jen do 7 rekurzí na 1 slovo. Velice rychlé a vìtšinou to staèí. (Pozor, pokud \"nevyzbude\" rekurze, nevyzbude na konci slova!)");
  m_oNapoveda.AddTool(GetDlgItem(IDC_STREDNIREKURZEPROHLEDAVANI),"<STANDARDNÌ>\nZde se prohledává do 11 rekurzí na 1 slovo. Rychlé a opravdu dostaèující.");
  m_oNapoveda.AddTool(GetDlgItem(IDC_VELKAREKURZEPROHLEDAVANI),"Zde se prohledává a do 15 rekurzí na 1 slovo. Mùe bıt pomalé.");
  m_oNapoveda.AddTool(GetDlgItem(IDC_MAXIMALNIREKURZEPROHLEDAVANI),"Zde není ádnı limit. Slovo se prohledá vdy celé. Program však mùe v krajních pøípadech \"zamrznout\" (zkus si napsat slovo \"yyyyyyyyyyyyyyyyyyyy\").");
  m_oNapoveda.AddTool(GetDlgItem(IDOK),"Zavøít toto okno a uloit (i do souboru) pøípadné zmìny v nastavení.");
  m_oNapoveda.AddTool(GetDlgItem(IDCANCEL),"Zavøít toto okno bez ukládání nastavení.");
 }
