// mfcDlg.cpp : implementation file
//

#include "stdafx.h"
#include "IQPokyd.h"
#include "mfcDlg.h"
#define IQPOKYDWINMFC 1
#include "\!iqpokyd\!Zdrojak\aplikace\hlavicky.in"

#ifdef _DEBUG
#define new DEBUG_NEW
#undef THIS_FILE
static char THIS_FILE[] = __FILE__;
#endif

/////////////////////////////////////////////////////////////////////////////
// CAboutDlg dialog used for App About

class CAboutDlg : public CDialog
{
public:
	CAboutDlg();

// Dialog Data
	//{{AFX_DATA(CAboutDlg)
	enum { IDD = IDD_ABOUTBOX };
	//}}AFX_DATA

	// ClassWizard generated virtual function overrides
	//{{AFX_VIRTUAL(CAboutDlg)
	protected:
	virtual void DoDataExchange(CDataExchange* pDX);    // DDX/DDV support
	//}}AFX_VIRTUAL

// Implementation
protected:
    CFont m_oFont1;
    CFont m_oFont2;
    CFont m_oFont3;
    CFont *m_hlavnifont;
    HWND m_HWNDpodekovani;
    HWND m_HWNDwwwadresy;

	//{{AFX_MSG(CAboutDlg)
	virtual BOOL OnInitDialog();
	afx_msg BOOL OnHelpInfo(HELPINFO* pHelpInfo);
	afx_msg HBRUSH OnCtlColor(CDC* pDC, CWnd* pWnd, UINT nCtlColor);
	afx_msg void OnKliknutiNaInternet();
	//}}AFX_MSG
	DECLARE_MESSAGE_MAP()
};

CAboutDlg::CAboutDlg() : CDialog(CAboutDlg::IDD)
{
	//{{AFX_DATA_INIT(CAboutDlg)
	//}}AFX_DATA_INIT
}

void CAboutDlg::DoDataExchange(CDataExchange* pDX)
{
	CDialog::DoDataExchange(pDX);
	//{{AFX_DATA_MAP(CAboutDlg)
	//}}AFX_DATA_MAP
}

BEGIN_MESSAGE_MAP(CAboutDlg, CDialog)
	//{{AFX_MSG_MAP(CAboutDlg)
	ON_WM_HELPINFO()
	ON_WM_CTLCOLOR()
	ON_WM_CANCELMODE()
	ON_WM_CAPTURECHANGED()
	ON_BN_CLICKED(IDC_INTERNET, OnKliknutiNaInternet)
	//}}AFX_MSG_MAP
END_MESSAGE_MAP()

/////////////////////////////////////////////////////////////////////////////
// CMfcDlg dialog

CMfcDlg::CMfcDlg(CWnd* pParent /*=NULL*/)
	: CDialog(CMfcDlg::IDD, pParent) {
      //{{AFX_DATA_INIT(CMfcDlg)
  m_vetacloveka = "";
      //}}AFX_DATA_INIT
      // Note that LoadIcon does not require a subsequent DestroyIcon in Win32
  pDlg = NULL;
 }

CMfcDlg::~CMfcDlg(void) {
  if (IsWindow(m_hWnd)) DestroyWindow();
 }

void CMfcDlg::DoDataExchange(CDataExchange* pDX) {
  CDialog::DoDataExchange(pDX);
                   //{{AFX_DATA_MAP(CMfcDlg)
  DDX_Text(pDX, IDC_CISLO, m_vetacloveka);
                   //}}AFX_DATA_MAP
 }

BEGIN_MESSAGE_MAP(CMfcDlg, CDialog)
	//{{AFX_MSG_MAP(CMfcDlg)
	ON_WM_SYSCOMMAND()
	ON_WM_PAINT()
	ON_WM_QUERYDRAGICON()
	ON_BN_CLICKED(IDC_NOVAVETA, OnNovaVeta)
	ON_WM_CLOSE()
	ON_COMMAND(ID_NASTAVENI, OnNastaveni)
	ON_COMMAND(ID_OPROGRAMU, OnAbout)
	ON_COMMAND(ID_KONEC, OnMenuClose)
	ON_WM_HELPINFO()
	ON_COMMAND(ID_OVERZI, OnOverzi)
	ON_COMMAND(ID_ZKRATKA_SMAZRADEK, OnZkratkaSmazradek)
	ON_COMMAND(ID_PREDCHOZIVETA, OnPredchoziveta)
	ON_COMMAND(ID_CHEAT_DEBUGINFO, OnCheatDebugInfo)
	ON_COMMAND(ID_MALANAPOVEDA, OnMalaNapoveda)
	ON_COMMAND(ID_VELKANAPOVEDA, OnVelkaNapoveda)
	ON_WM_CTLCOLOR()
	ON_EN_CHANGE(IDC_VETA, OnZmenaEdituVety)
	ON_COMMAND(ID_ZLEPSENINALADY, OnZlepseniNalady)
	ON_COMMAND(ID_ZHORSENINALADY, OnZhorseniNalady)
	ON_COMMAND(ID_ZHORSENICHARAKTERU, OnZhorseniCharakteru)
	ON_COMMAND(ID_ZLEPSENICHARAKTERU, OnZlepseniCharakteru)
	ON_WM_SIZE()
	ON_WM_GETMINMAXINFO()
	ON_WM_QUERYENDSESSION()
	ON_COMMAND(ID_NAPOVEDA_INTERNET, OnJdiNaStrankyOIQPokydu)
	ON_EN_SETFOCUS(IDC_VETA, OnSetfocusVeta)
	ON_EN_KILLFOCUS(IDC_VETA, OnKillfocusVeta)
	//}}AFX_MSG_MAP
END_MESSAGE_MAP()

/////////////////////////////////////////////////////////////////////////////
// CMfcDlg message handlers

LRESULT CALLBACK WindowProcEdit(HWND hWnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
static BYTE carka=0,hacek=0,krouzek=0,prehlasovani=0;
BYTE shift=0,capslock=0,scankod;
static LPTSTR tuknuti=NULL;

  if (uMsg == 258 && (GetKeyState(VK_CONTROL) & 32768) != 32768) {
    scankod=(BYTE)((DWORD)(lParam/65536));

    if (tuknuti == NULL) tuknuti=MAKEINTRESOURCE(IDR_ZVUK_TUKNUTI);
    if (g_nastaveni.pouzivatzvuky == 1 && g_tuknuti.aktualnipocetzvuku > 0) {
      PlaySound(g_tuknuti.zvuky[scankod%g_tuknuti.aktualnipocetzvuku], g_instanceprogramu, SND_ASYNC | SND_MEMORY);
     }

    if (g_nastaveni.emulovatklavesnici == 0) goto KONEC;

    if ((GetKeyState(VK_SHIFT) & 32768) == 32768) shift=1;
    if ((GetKeyState(VK_CAPITAL) & 1) == 1) capslock=1;

    switch(scankod) {
      case 16: wParam='q'; break;
      case 17: wParam='w'; break;
      case 18: wParam='e'; break;
      case 19: wParam='r'; break;
      case 20: wParam='t'; break;
      case 21: if (g_nastaveni.klavesniceqwerty == 1) wParam='y';
               else wParam='z'; break;
      case 22: wParam='u'; break;
      case 23: wParam='i'; break;
      case 24: wParam='o'; break;
      case 25: wParam='p'; break;

      case 30: wParam='a'; break;
      case 31: wParam='s'; break;
      case 32: wParam='d'; break;
      case 33: wParam='f'; break;
      case 34: wParam='g'; break;
      case 35: wParam='h'; break;
      case 36: wParam='j'; break;
      case 37: wParam='k'; break;
      case 38: wParam='l'; break;

      case 44: if (g_nastaveni.klavesniceqwerty == 1) wParam='z';
               else wParam='y'; break;
      case 45: wParam='x'; break;
      case 46: wParam='c'; break;
      case 47: wParam='v'; break;
      case 48: wParam='b'; break;
      case 49: wParam='n'; break;
      case 50: wParam='m'; break;

      default: hacek=0; carka=0; krouzek=0; prehlasovani=0;
               goto SPECIALNI_ZNAK;
     }

    if (hacek == 1) {
      switch(wParam) {
        case 'e': wParam='ì'; break;
        case 'r': wParam='ø'; break;
        case 't': wParam=''; break;
        case 's': wParam='š'; break;
        case 'd': wParam='ï'; break;
        case 'l': wParam='¾'; break;
        case 'z': wParam=''; break;
        case 'c': wParam='è'; break;
        case 'n': wParam='ò'; break;
       }
      hacek=0;
     }
    if (carka == 1) {
      switch(wParam) {
        case 'e': wParam='é'; break;
        case 'r': wParam='à'; break;
        case 'y': wParam='ı'; break;
        case 'u': wParam='ú'; break;
        case 'i': wParam='í'; break;
        case 'o': wParam='ó'; break;
        case 'a': wParam='á'; break;
        case 's': wParam='œ'; break;
        case 'l': wParam='å'; break;
        case 'z': wParam='Ÿ'; break;
        case 'c': wParam='æ'; break;
        case 'n': wParam='ñ'; break;
       }
      carka=0;
     }
    if (krouzek == 1) {
      switch(wParam) {
        case 'u': wParam='ù'; break;
       }
      krouzek=0;
     }
    if (prehlasovani == 1) {
      switch(wParam) {
        case 'e': wParam='ë'; break;
        case 'u': wParam='ü'; break;
        case 'o': wParam='ö'; break;
        case 'a': wParam='ä'; break;
       }
      prehlasovani=0;
     }

    if ((shift == 1 && capslock == 0) || (shift == 0 && capslock == 1))
     wParam=VRAT_VELKE_PISMENO(wParam);             //velke pismeno

    goto KONEC;

    SPECIALNI_ZNAK:
    if (shift == 0) {
      switch(scankod) {
        case 41: wParam=';'; break;
        case  2: wParam='+'; break;
        case  3: if (g_nastaveni.emulovatklavesnici == 1) wParam='ì';
                 else wParam='¾'; break;      //slovensky
        case  4: wParam='š'; break;
        case  5: wParam='è'; break;
        case  6: if (g_nastaveni.emulovatklavesnici == 1) wParam='ø';
                 else wParam=''; break;      //slovensky
        case  7: wParam=''; break;
        case  8: wParam='ı'; break;
        case  9: wParam='á'; break;
        case 10: wParam='í'; break;
        case 11: wParam='é'; break;
        case 12: wParam='='; break;
        case 13: carka=1; return(0);
        case 43: if (g_nastaveni.emulovatklavesnici == 1) { prehlasovani=1; return(0); }
                 else wParam='ò'; break;      //slovensky

        case 26: wParam='ú'; break;
        case 27: if (g_nastaveni.emulovatklavesnici == 1) wParam=')';
                 else wParam='ä'; break;      //slovensky

        case 39: if (g_nastaveni.emulovatklavesnici == 1) wParam='ù';
                 else wParam='ô'; break;      //slovensky
        case 40: wParam='§'; break;

        case 51: wParam=','; break;
        case 52: wParam='.'; break;
        case 53: wParam='-'; break;

        default: goto KONEC;
       }
      if (capslock == 1) wParam=VRAT_VELKE_PISMENO(wParam);
     }
    if (shift == 1) {
      switch(scankod) {
        case 41: krouzek=1; return(0);
        case  2: wParam='1'; break;
        case  3: wParam='2'; break;
        case  4: wParam='3'; break;
        case  5: wParam='4'; break;
        case  6: wParam='5'; break;
        case  7: wParam='6'; break;
        case  8: wParam='7'; break;
        case  9: wParam='8'; break;
        case 10: wParam='9'; break;
        case 11: wParam='0'; break;
        case 12: wParam='%'; break;
        case 13: hacek=1; return(0);
        case 43: if (g_nastaveni.emulovatklavesnici == 1) wParam='\'';
                 else wParam=')'; break;      //slovensky

        case 26: wParam='/'; break;
        case 27: wParam='('; break;

        case 39: wParam='\"'; break;
        case 40: wParam='!'; break;

        case 51: wParam='?'; break;
        case 52: wParam=':'; break;
        case 53: wParam='_'; break;

        default: goto KONEC;
       }
     }
   }

  KONEC:
  return CallWindowProc(g_MfcDlghlavniokno.oldProc, hWnd, uMsg, wParam, lParam);
 }

BOOL CMfcDlg::OnInitDialog() {
  m_hIcon16 = AfxGetApp()->LoadIcon(IDI_TVAR16);
  m_hIcon32 = AfxGetApp()->LoadIcon(IDI_TVAR);

  ghDlg = m_hWnd;          //pro klavesove zkratky
  g_HWNDhlavnihookna=m_hWnd;
  g_instanceprogramu=AfxGetInstanceHandle();
  g_CWndhlavnihookna=this;
  CPaintDC dc(this); // device context for painting
  g_HDChlavnihookna=dc.GetSafeHdc();

  g_HWNDhlavickovychtextu[0]=::GetDlgItem(g_HWNDhlavnihookna,IDC_NADPIS1);
  g_HWNDhlavickovychtextu[1]=::GetDlgItem(g_HWNDhlavnihookna,IDC_NADPIS2);
  g_HWNDhlavickovychtextu[2]=::GetDlgItem(g_HWNDhlavnihookna,IDC_NADPIS3);
              //pro nasledne porovnavani, jakou barvou ma byt jejich text


  CDialog::OnInitDialog();

	// Add "About..." menu item to system menu.

	// IDM_ABOUTBOX must be in the system command range.
  ASSERT((IDM_ABOUTBOX & 0xFFF0) == IDM_ABOUTBOX);
  ASSERT(IDM_ABOUTBOX < 0xF000);

  CMenu *cmenu = GetSystemMenu(FALSE);
//  while (pSysMenu->RemoveMenu(0,MF_BYPOSITION));
  if (cmenu != NULL) {
    cmenu->InsertMenu(0,MF_BYPOSITION | MF_STRING,IDM_ABOUTBOX,"O IQ Pokydu...");
    cmenu->InsertMenu(1,MF_BYPOSITION | MF_SEPARATOR);
    cmenu->InsertMenu(2,MF_BYPOSITION | MF_SEPARATOR);
   }

	// Set the icon for this dialog.  The framework does this automatically
	//  when the application's main window is not a dialog
  SetIcon(m_hIcon32, TRUE);			// Set big icon    ??????
  SetIcon(m_hIcon32, FALSE);		// Set small icon  ??????

/*
 MessageBox(""
      "TESTOVACÍ VERZE PROGRAMU IQ POKYD!\r\n\r\n"
      "Prosím nerozšiøujte tuto verzi, je pouze pro testovací úèely a NEFUNGUJE! "
      "Toto je \"opravená\" verze, tj. pokud by fungovala (pozadí Editu by bylo opravdu èerné), tak jsem to úspìšnì vyøešil :-)\r\n\r\n"
      "www.kyblsoft.cz"
      "","Upozornìní",MB_ICONINFORMATION | MB_SYSTEMMODAL);
*/



  srand(time(NULL));

  {
   HFONT hFont;
   LOGFONT font;

   ZeroMemory(&font, sizeof(LOGFONT));
   font.lfHeight = -18;
   font.lfWeight = 500; 
   strcpy(font.lfFaceName,"Trebuchet MS");

   hFont=CreateFontIndirect(&font);
   GetDlgItem(IDC_NADPIS1)->SendMessage(WM_SETFONT,(WPARAM)hFont,TRUE);
   GetDlgItem(IDC_NADPIS3)->SendMessage(WM_SETFONT,(WPARAM)hFont,TRUE);

   font.lfHeight = -22;
   font.lfWeight = 800; 
   strcpy(font.lfFaceName,"Garamond");

   hFont=CreateFontIndirect(&font);
   GetDlgItem(IDC_NADPIS2)->SendMessage(WM_SETFONT,(WPARAM)hFont,TRUE);
  }

  HMENU menu=::GetMenu(g_HWNDhlavnihookna);
  HBITMAP bitmapa;
  bitmapa=LoadBitmap(g_instanceprogramu,MAKEINTRESOURCE(IDB_MENUNASTAVENI));
  SetMenuItemBitmaps(menu,ID_NASTAVENI,MF_BYCOMMAND,bitmapa,NULL);
  bitmapa=LoadBitmap(g_instanceprogramu,MAKEINTRESOURCE(IDB_MENUKONEC));
  SetMenuItemBitmaps(menu,ID_KONEC,MF_BYCOMMAND,bitmapa,NULL);
  bitmapa=LoadBitmap(g_instanceprogramu,MAKEINTRESOURCE(IDB_MENUMALANAPOVEDA));
  SetMenuItemBitmaps(menu,ID_MALANAPOVEDA,MF_BYCOMMAND,bitmapa,NULL);
  bitmapa=LoadBitmap(g_instanceprogramu,MAKEINTRESOURCE(IDB_MENUVELKANAPOVEDA));
  SetMenuItemBitmaps(menu,ID_VELKANAPOVEDA,MF_BYCOMMAND,bitmapa,NULL);
  bitmapa=LoadBitmap(g_instanceprogramu,MAKEINTRESOURCE(IDB_MENUINTERNET));
  SetMenuItemBitmaps(menu,ID_NAPOVEDA_INTERNET,MF_BYCOMMAND,bitmapa,NULL);
  bitmapa=LoadBitmap(g_instanceprogramu,MAKEINTRESOURCE(IDB_MENUOVERZI));
  SetMenuItemBitmaps(menu,ID_OVERZI,MF_BYCOMMAND,bitmapa,NULL);
  bitmapa=LoadBitmap(g_instanceprogramu,MAKEINTRESOURCE(IDB_MENUOPROGRAMU));
  SetMenuItemBitmaps(menu,ID_OPROGRAMU,MF_BYCOMMAND,bitmapa,NULL);

  g_nastaveni.NASTAV_STANDARDNE();

  g_aktualnivetacloveka=ALOKUJ_RETEZEC(1); g_aktualnivetacloveka[0]=0;
  g_predchozivetacloveka=ALOKUJ_RETEZEC(1); g_predchozivetacloveka[0]=0;
  g_zaznamrozhovoru="";

  debug_poslednipodmetcloveka=ALOKUJ_RETEZEC(DELKA_JEDNODUCHEHO_SLOVA);
  strcpy(debug_poslednipodmetcloveka,"-");
  debug_posledniprisudekcloveka=ALOKUJ_RETEZEC(DELKA_JEDNODUCHEHO_SLOVA);
  strcpy(debug_posledniprisudekcloveka,"-");
  debug_poslednipredmetcloveka=ALOKUJ_RETEZEC(DELKA_JEDNODUCHEHO_SLOVA);
  strcpy(debug_poslednipredmetcloveka,"-");

  g_tuknuti.VYTVOR_PRVNI();
  for (int i=0; i < 100; i++) {
    g_MfcDlghlavniokno.policka[i] = NULL;
   }

  ((CButton *)GetDlgItem(IDC_NOVAVETA))->SetIcon(LoadIcon(g_instanceprogramu,MAKEINTRESOURCE(IDI_TVAR)));

  ZOBRAZ_HLASKU_NA_POZADI(_UVODNI_KEC_,g_HWNDhlavnihookna);
  PREKRESLI_PRVKY_V_OKNE_PRI_ZMENE_VELIKOSTI(0,0);

DWORD dwVlakno1,dwVlakno2;
  g_bezivlaknohlasek=1;
  g_handlevlaknahlasek=::CreateThread(NULL,0,VLAKNO__HLASKY_A_OPERACE_NA_POZADI,(LPVOID)0,0,&dwVlakno1);
  if (!g_handlevlaknahlasek) NAHLAS_CHYBU(__FILE__,__LINE__,_NESPECIFIKOVANO_,_UKONCIT_);

  g_bezivlaknoefektu=1;
  g_handlevlaknaefektu=::CreateThread(NULL,0,VLAKNO__EFEKTY,(LPVOID)0,0,&dwVlakno2);
  if (!g_handlevlaknaefektu) NAHLAS_CHYBU(__FILE__,__LINE__,_NESPECIFIKOVANO_,_UKONCIT_);

  switch(PRECTI_NASTAVENI_ZE_SOUBORU()) {
    case 0: g_zobrazitnastaveni=1; break;      //soubor neexistuje
    case 1: break;                    //OK
    case 2: g_nastaveni.NASTAV_STANDARDNE();   //soubor je narusen
            ZOBRAZ_HLASKU_NA_POZADI(_NEKDO_SI_HRAL_S_NASTAVENIM_,g_HWNDhlavnihookna);
            g_zobrazitnastaveni=1;
            break;
   }
  NAPIS_UVODNI_UVITANI();
  ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI();
  NASTAV_VIDITELNOST_EFEKTNICH_PROGRESSBARU();
  NASTAV_VIDITELNOST_POZADI(1);

  NactiSlovniky();


  oldProc = (WNDPROC)SetWindowLong(GetDlgItem(IDC_VETA)->m_hWnd,
   GWL_WNDPROC, (LONG)WindowProcEdit);
                          //pro emulovani ceske klavesnice

  return TRUE;  // return TRUE  unless you set the focus to a control
 }

void CMfcDlg::OnSysCommand(UINT nID, LPARAM lParam)
{
	if ((nID & 0xFFF0) == IDM_ABOUTBOX)
	{
		CAboutDlg dlgAbout;
		dlgAbout.DoModal();
	}
	else
	{
		CDialog::OnSysCommand(nID, lParam);
	}
}

// If you add a minimize button to your dialog, you will need the code below
//  to draw the icon.  For MFC applications using the document/view model,
//  this is automatically done for you by the framework.

void CMfcDlg::OnPaint() {
  if (IsIconic()) {
    CPaintDC dc(this); // device context for painting

    SendMessage(WM_ICONERASEBKGND, (WPARAM) dc.GetSafeHdc(), 0);

		// Center icon in client rectangle
    int cxIcon = GetSystemMetrics(SM_CXICON);
    int cyIcon = GetSystemMetrics(SM_CYICON);
    CRect rect;
    GetClientRect(&rect);
    int x = (rect.Width() - cxIcon + 1) / 2;
    int y = (rect.Height() - cyIcon + 1) / 2;

        // Draw the icon
    dc.DrawIcon(x, y, m_hIcon16);
   }
  else {
    CDialog::OnPaint();
   }
 }

// The system calls this to obtain the cursor to display while the user drags
//  the minimized window.
HCURSOR CMfcDlg::OnQueryDragIcon() {
	return (HCURSOR) m_hIcon16;
}

void CMfcDlg::NactiSlovniky() {

	/*
		Pokud není objekt tøídy dialogu vytvoøen, vytvoøíme ho.
	*/
	if (!pDlg) pDlg = new CNacitani;
	/*
        Pokud promìnná handle okna v tøídì dialogu
        nemá hodnotu platného okna, 
        tj. není vytvoøen nemodální (nebo modální) dialog,
        vytvoøíme nemodální dialog.
        První parametr funkce Create je identifikátor šablony dialogu,
        která patøí 
        k tøídì vytváøeného nemodálního dialogu
        a druhı parametr je ukazatel na 
        rodièovské okno. V tomto pøípadì je
        to ukazatel na objekt tøídy hlavního 
        dialogu aplikace, ze které je nemodální dialog vytváøen.
	*/
	if (!::IsWindow(pDlg->m_hWnd)) pDlg->Create(IDD_NACITANI,this);
	/*
        Následující øádek kontroluje,
        zda byl nemodální dialog zobrazen a pokud ne, zobrazí 
        jej pomocí funkce ShowWindow.
        Její parametr udává, jakım zpùsobem je nemodální dialog
        zobrazen. Tato funkce je u všech oken
        a pomocí ní mùete ve svıch aplikacích mìnit
        zpùsob zobrazení okna. 
        U modálního dialogu by se tato funkce provedla
        a po uzavøení dialogu, ale u nemodálního
        dialogu funkce, která jej vytváøí, neèeká na jeho uzavøení.
	*/
	if (!pDlg->IsWindowVisible()) pDlg->ShowWindow(SW_SHOW);
	/*
        Teï ještì zmìníme titulek nemodálního dialogu,
        aby byl na první pohled rozeznat od
        modálního dialogu, i kdy je k jeho vytvoøení
        pouita stejná šablona a tøída dialogu
        jako pro vytvoøení modálního dialogu.
	*/
	pDlg->SetWindowText("Naèítání slovníku...");

  g_handletext1=(CStatic*)pDlg->GetDlgItem(IDC_TEXT);
  g_handletext2=(CStatic*)pDlg->GetDlgItem(IDC_PROCENTA);

  g_HWNDpodokna=pDlg->m_hWnd;
  WINMFC_NACTI_SLOVNIKY();
 }

void CMfcDlg::OnNovaVeta() {
CString puvodniobsah,novyobsah,novejsiobsah;    // pomocné promìnné
char *cheat1=NULL,*cheat2=NULL;

  UpdateData(TRUE);
  if (m_vetacloveka == "") return;

  g_aktualnivetacloveka=(char *)REALOKUJ_PAMET(g_aktualnivetacloveka,m_vetacloveka.GetLength()+1);
  _tcscpy(g_aktualnivetacloveka,m_vetacloveka);

  if (g_aktualnivetacloveka[0] == ':' && g_aktualnivetacloveka[1] == ':' && strcmp(g_aktualnivetacloveka+2,"debuginfo") == 0) {
    OnCheatDebugInfo(); return;
   }

  if (g_bezivlaknoprocesu == 1) return;

  g_akceefektu=1;           //efekt vertikalniho vyjizdeni nahoru

  CStatic* pStatic = (CStatic*)GetDlgItem(IDC_VETA);
  pStatic->SetWindowText("");

/*         //tady byl cheat, ale jen ve verzi 0.1
  if (m_vetacloveka == "") {
    CText dlg;
    dlg.nadpis="Nadpis";
    cheat1=VRAT_TEXT_CHEATU();
    cheat2=ALOKUJ_RETEZEC(strlen(cheat1)+1);
    strcpy(cheat2,cheat1);
    for (int pozice=0; cheat2[pozice] != 0; pozice++)
     cheat2[pozice]^=128;
    dlg.text=cheat2; UVOLNI(cheat2);
    dlg.DoModal();
    return;
   }
*/
  if (g_aktualnivetacloveka[9] == ':' && strncmp(g_aktualnivetacloveka,"kıbl",4) == 0 && strncmp(g_aktualnivetacloveka+4,"verše",5) == 0) {
    CText dlg;
  
    dlg.nadpis="Vıpis slov shodující se v koncovce:";
    dlg.text=_NAJDI_BASNICKE_SLOVO(g_aktualnivetacloveka+10);

    dlg.DoModal();
    goto KONEC;
   }

  PREVED_NA_MALA_PISMENA(g_aktualnivetacloveka);
  UPRAV_DLOUHE_SLOVO_PRO_IQPOKYD(g_aktualnivetacloveka);
  g_aktualnivetacloveka=UPRAV_VETU_PRO_IQPOKYD(g_aktualnivetacloveka);
  IQ_POKYDE_ODPOVEZ(g_aktualnivetacloveka);
  ODUPRAV_VETU_PRO_IQPOKYD();

  _tcscpy(g_aktualnivetacloveka,m_vetacloveka);
  NAPIS_VETU_S_ODPOVEDI_NA_OBRAZOVKU(g_aktualnivetacloveka,g_odpovedpocitace);


  g_predchozivetacloveka=(char *)REALOKUJ_PAMET(g_predchozivetacloveka,m_vetacloveka.GetLength()+1);
  _tcscpy(g_predchozivetacloveka,m_vetacloveka);

  ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI();

  KONEC:
  m_vetacloveka="";
  
  pStatic->SetFocus();
 }

void CMfcDlg::OnClose() {
char *nadpis=NULL;
  if (g_bezivlaknoprocesu == 1) {
    if (g_zavritvlaknoprocesu == 1) {
      ::PostMessage(g_HWNDpodokna,WM_CLOSE,0,0);
      Sleep(1000);  //a pokracuj v ukoncovani
     }
    else {
      ::SetFocus(g_HWNDpodokna); return;
     }
   }
  if (g_zobrazenahlaska == 1) return;

  if (g_nastaveni.ukladatrozhovor == 1) ULOZ_KYDY();
  ULOZ_BINARNI_KYDY();
  ZAPIS_PROFIL_DO_SOUBORU();

  nadpis=ALOKUJ_RETEZEC(120);
  GetWindowText(nadpis,100);
  strcat(nadpis," - tak zatím...");
  ::SetWindowText(g_HWNDhlavnihookna,nadpis);
  UVOLNI(nadpis);

  if (g_bezivlaknohlasek == 1 || g_bezivlaknoprocesu == 1
   || g_bezivlaknoprocent == 1 || g_bezivlaknoefektu == 1) {
    g_zavritvlaknohlasek=1; g_zavritvlaknoprocesu=1; g_zavritvlaknoprocent=1; g_zavritvlaknoefektu=1;
                                   //uzavreni vsech vlaken
    for (int i=0; i < 20; i++) {     //pockat 1 sekundu
      if (g_bezivlaknoprocesu == 0 && g_bezivlaknoprocent == 0 && g_bezivlaknoefektu == 0) break;
      Sleep(50);
     }
    if (g_bezivlaknohlasek == 1) {
      if (g_bezivlaknoprocesu == 0 && g_bezivlaknoprocent == 0)
       while (g_bezivlaknohlasek == 1) Sleep(10);
      else NAHLAS_CHYBU(__FILE__,__LINE__,_NESPECIFIKOVANO_,_UKONCIT_);
     }
    Sleep(50);    //uplne uzavreni vlaken
   }
  if (g_nastaveni.debug_rychleukoncovani == 0)
   WINMFC_UVOLNI_VESKEROU_DYNAMICKOU_PAMET();
	
#if FINALNI_VERZE == 0
  if (debug_pocetalokovani > 0 && g_nestandardniukonceni == 0 && g_nastaveni.debug_rychleukoncovani == 0)
   NAHLAS_CHYBU(NULL,0,_NEDEALOKOVANY_VSECHNY_BLOKY_,_UKONCIT_); // printf("Chyba!!! Prekrocen maximalni pocet slov! (%lu)",MAX_POCET_VSECH_SLOV);
#endif

  CDialog::OnClose();

  if (g_nastaveni.debug_rychleukoncovani == 1) raise(SIGABRT);
 }

BOOL CAboutDlg::OnInitDialog() {
  CDialog::OnInitDialog();

  m_HWNDpodekovani=GetDlgItem(IDC_PODEKOVANI)->m_hWnd;
  m_HWNDwwwadresy=GetDlgItem(IDC_INTERNET)->m_hWnd;

  LOGFONT lf;
  CFont *cFont;
  CEdit* pEdit = (CEdit*)GetDlgItem(IDC_INTERNET);
  ZeroMemory(&lf, sizeof(LOGFONT));

  cFont = pEdit->GetFont();
  cFont->GetLogFont(&lf);
  lf.lfCharSet = EASTEUROPE_CHARSET;
  lf.lfUnderline=TRUE;
  m_oFont1.CreateFontIndirect(&lf);
  pEdit->SetFont(&m_oFont1);

//  ((CStatic *)GetDlgItem(IDOK))->
  SetClassLong(pEdit->m_hWnd, GCL_HCURSOR, (LONG)LoadCursor(NULL, MAKEINTRESOURCE(32649)));
//  SetCursor(LoadCursor(NULL, IDC_IBEAM));



  pEdit = (CEdit*)GetDlgItem(IDC_PODEKOVANI);
  ZeroMemory(&lf, sizeof(LOGFONT));

  cFont = pEdit->GetFont();
  cFont->GetLogFont(&lf);
  lf.lfHeight = -12;
//  lf.lfWeight = FW_LIGHT;
  lf.lfCharSet = EASTEUROPE_CHARSET;
  strcpy(lf.lfFaceName, "Times New Roman");
  m_oFont2.CreateFontIndirect(&lf);
  pEdit->SetFont(&m_oFont2);

  pEdit->SetWindowText(
    "Za pomoc pøi tvorbì tohoto programu dìkuji:\r\n"
    " - Davidu Koøínkovi za spoustu cennıch rad a v podporování mého úsilí\r\n"
    " - Michaele Chomátové za neocenitelnou pomoc pøi tvoøení slovníku a za 3 krásné spoleèné roky\r\n"
    " - Šimonu Skálovi, Wibemu, Vlèákovi, Medvìdovi, Markétì Lorenzové, Petru Bernému a spoustu dalším za pomoc s dìláním programu\r\n"
    " - autorùm konkurenèních programù, zejména Martinovi Gramesovi (Kecal) a Michalu Antonièovi (Ludvik) za podporu a motivaci\r\n"
    " - všem, kteøí mi jakkoli pomohli a v tomto vıètu jsem na nì zapomnìl\r\n"
    " - veškerım fanouškùm \"starého\" Pokydu za psychickou podporu, bez které by IQ Pokyd nikdy nevznikl\r\n"
    " - všem uivatelùm IQ Pokydu za jeho pouívání a tím i podporování freewaru\r\n\r\n"
    "Tento program je freeware. Lze ho libovolnì šíøit a uívat. Musí se však rozšiøovat "
    "se všemi soubory (podrobnìji viz Velká nápovìda), nesmíš mì modifikovat nebo šíøit za poplatky.\r\n"
    "Více o šíøení najdeš ve Velké nápovìdì.");


  pEdit = (CEdit*)GetDlgItem(IDC_NADPIS);
  ZeroMemory(&lf, sizeof(LOGFONT));
  lf.lfHeight = 20;
  lf.lfWeight = FW_BLACK;
  lf.lfCharSet = EASTEUROPE_CHARSET;
  strcpy(lf.lfFaceName, "Courier New");
  m_oFont3.CreateFontIndirect(&lf);
  pEdit->SetFont(&m_oFont3);

  return TRUE;  // return TRUE unless you set the focus to a control
	              // EXCEPTION: OCX Property Pages should return FALSE
 }

void CMfcDlg::OnVelkaNapoveda() {
DWORD vysledek;
CString koncovkapohlavi,sam;
char *hlaska=NULL,*prohlizec=NULL,*soubor=NULL;

  prohlizec=ALOKUJ_RETEZEC(MAX_PATH);
  soubor=ALOKUJ_RETEZEC(MAX_PATH);

  GetModuleFileName(NULL,soubor,MAX_PATH);
  strcpy(strrchr(soubor,'\\')+1,JMENO_SOUBORU_S_NAPOVEDOU);

  vysledek=(DWORD)FindExecutable(soubor,NULL,prohlizec);
  switch(vysledek) {
    case 0:  //The operating system is out of memory or resources.
      MALOPAMETI:
      NAHLAS_CHYBU("Bohuel, zbıvá jen velice málo operaèní pamìti na zobrazení \"Velké nápovìdy\".\n\nUkonèi nìkteré programy, zvìtši stránkovací (virtuální) pamì nebo popø. uvolni místo na disku se stránkovacím souborem a zkus to znovu.",0,_JINA_CHYBA_,_POKRACOVAT_);
      goto KONEC;
    case ERROR_FILE_NOT_FOUND: //The specified file was not found.
    case ERROR_PATH_NOT_FOUND: //The specified path was not found.
      NEEXISTUJE:
      hlaska=ALOKUJ_RETEZEC(500);
      sprintf(hlaska,"Bohuel, soubor \"" JMENO_SOUBORU_S_NAPOVEDOU "\" z nìjakého dùvodu neexistuje. To je ale docela chyba a mìl%s by sis nahrát IQ Pokyd znovu.\n\nPokud u nemáš pøístup ke zdroji, stáhni si ho z \"http://iqpokyd.kyblsoft.cz\".",g_nastaveni.pohlavicloveka == 2 ? "a" : "");
      NAHLAS_CHYBU(hlaska,0,_JINA_CHYBA_,_POKRACOVAT_);
      UVOLNI(hlaska);
      goto KONEC;
    case 31:                   //.htm není s nièím asociován
      NAHLAS_CHYBU("Je mi líto, ale není èím otevøít HTML soubor s nápovìdou, respektive pøípona .htm není asociována s ádnım programem. Take doporuèuji napøed nakonfigurovat poèítaè tak, aby .htm soubory otevíral v nìjakém prohlíeèi (napø. Explorer).",0,_JINA_CHYBA_,_POKRACOVAT_);
      goto KONEC;
    default:
      if (vysledek <= 32) {             //neznama chyba
        ZAHADNYDUVOD:
        hlaska=ALOKUJ_RETEZEC(500);
        sprintf(hlaska,"Bohuel, z jakéhosi záhadného dùvodu nemám pøístup k souboru \"" JMENO_SOUBORU_S_NAPOVEDOU "\", kde je nápovìda uloena, take ti ji nemùu zobrazit. Zatím si holt musíš poradit %s.",g_nastaveni.pohlavicloveka == 2 ? "sama" : "sám");
        NAHLAS_CHYBU(hlaska,0,_JINA_CHYBA_,_POKRACOVAT_);
        UVOLNI(hlaska);
        goto KONEC;
       }
      break;
   }

  vysledek=(DWORD)ShellExecute(m_hWnd,"open",prohlizec,soubor,NULL,SW_MAXIMIZE);
  switch(vysledek) {
    case 0: goto MALOPAMETI;
    case ERROR_FILE_NOT_FOUND: //The specified file was not found.
    case ERROR_PATH_NOT_FOUND: //The specified path was not found.
      goto NEEXISTUJE;
    default:
      if (vysledek <= 32) goto ZAHADNYDUVOD;
      break;
   }

  KONEC:
  UVOLNI(soubor);
  UVOLNI(prohlizec);
 }

void CMfcDlg::OnMalaNapoveda() {
  ZOBRAZ_NAPOVEDU();
 }

void CMfcDlg::OnNastaveni() {
static BYTE ukazanonastaveni=0;
CNastaveni dlg;
  if (ukazanonastaveni == 1) return;
  ukazanonastaveni=1;
  dlg.DoModal();
  delete dlg;
  ukazanonastaveni=0;
 }

void CMfcDlg::OnAbout() {
  CAboutDlg dlgAbout;
  dlgAbout.DoModal();
 }

void CMfcDlg::OnMenuClose() {
  AfxGetMainWnd()->SendMessage(WM_CLOSE);
 }

BOOL CMfcDlg::OnHelpInfo(HELPINFO* pHelpInfo) {
  return TRUE;
 }

void CMfcDlg::OnOverzi() {
  CText dlg;

  CString pohlavi,dlpohlavi;
  if (g_nastaveni.pohlavicloveka == 2) { pohlavi="a"; dlpohlavi="á"; }
  else { pohlavi=""; dlpohlavi="ı"; }

  dlg.nadpis="IQ Pokyd v0.15 - popis verze";
  dlg.text="<h><u>IQ Pokyd v0.15 - KİBLSoft 1999-2005</u></h>\r\n\r\n"
"<c>Toto je "VYDANI_VERZE_PROGRAMU". vydání této verze.</c>\r\n\r\n"
"Trochu svìtla do objasnìní této verze, pøedchozích a budoucích verzí:\r\n\r\n"
"Tento program \"IQ Pokyd\" je pøímım následníkem pùvodního programu "
"\"Pokyd\" (poslední verze 7.0). Ten se vyvíjel do roku 2002 a slouil ke "
"stejnému úèelu jako nynìjší IQ Pokyd, ale ji neumoòoval pøílišné vylepšení. "
"Proto byl celı program postaven úplnì jinak a vzniknul z toho právì tento "
"\"IQ Pokyd\".\r\n"
"Tato verze IQ Pokydu (verze 0.15) je jednou z prvních verzí vùbec tohoto nového "
"projektu a zatím zdaleka nevyuívá všech moností, kterıch vyuívat "
"mùe a které zkvalitní hovor s poèítaèem. Další vylepšení, kterıch "
"je pomìrnì dost, budou obsaeny v pøíštích verzích\r\n"
"Zatím proto prosím buï shovívav"+dlpohlavi+".\r\n\r\n"
"<c>V souèasné verzi zejména chybí:</c>\r\n"
" - \"uèení se\" novım vìcem\r\n"
" - neuronová sí (systém myšlení)\r\n"
" - podpora zvratnıch zájmen se a si\r\n"
" - podpora velkıch písmen (napø. ve jménech)\r\n"
" - porozumìní novım slovùm a èíslovkám\r\n\r\n"
"Veškeré nové verze (a pøípadnì i pùvodní Pokyd 7.0) nalezneš "
"ke staení na internetové adrese\r\n"
"<c>http://iqpokyd.kyblsoft.cz</c>\r\n\r\n"
"Aleš Janda, KİBLSoft";

  dlg.DoModal();
 }

void CMfcDlg::OnZkratkaSmazradek() {
HWND cozavrit;
CStatic* pStatic;

/*  cozavrit=::GetForegroundWindow();
  cozavrit=::FindWindow(NULL,"IQ Pokyd v0.15");

  if (::IsChild(g_HWNDhlavnihookna,cozavrit) == TRUE) {
    ::SendMessage(cozavrit,WM_CLOSE,0,0); return;
   }*/
  cozavrit=::FindWindow(NULL,"IQ Pokyd - nastavení");
  if (cozavrit == NULL) cozavrit=::FindWindow(NULL,"IQ Pokyd - nápovìda");
  if (cozavrit == NULL) cozavrit=::FindWindow(NULL,"IQ Pokyd v0.15 - popis verze");
  if (cozavrit == NULL) cozavrit=::FindWindow(NULL,"O IQ Pokydu");
  if (cozavrit == NULL) cozavrit=::FindWindow(NULL,"IQ Pokyd v0.15 - DEBUG INFO");
  if (cozavrit != NULL && cozavrit != g_HWNDhlavnihookna) {
    ::SendMessage(cozavrit,WM_CLOSE,0,0); return;
   }
  UpdateData(TRUE);
  if (m_vetacloveka != "") {
    pStatic = (CStatic*)GetDlgItem(IDC_VETA);
    pStatic->SetWindowText("");         //smazani radku
   }
 }

void CMfcDlg::OnPredchoziveta() {
DWORD delkavety=strlen(g_predchozivetacloveka);
  CStatic* pStatic = (CStatic*)GetDlgItem(IDC_VETA);
  pStatic->SetWindowText(g_predchozivetacloveka);
  SendDlgItemMessage(IDC_VETA,EM_SETSEL,delkavety,delkavety); //kurzor na konec
 }

BOOL CAboutDlg::OnHelpInfo(HELPINFO* pHelpInfo) {
  ZOBRAZ_NAPOVEDU();
  return TRUE;
 }

#include "debugnastaveni.cpp"

void CMfcDlg::OnCheatDebugInfo() {
static BYTE praveukazovano=0;
CDebugNastaveni dlg;

  if (praveukazovano == 1) return;
  else praveukazovano=1;

  dlg.DoModal();

  praveukazovano=0;
 }

HBRUSH CMfcDlg::OnCtlColor(CDC* pDC, CWnd* pWnd, UINT nCtlColor) {
static BYTE poprve=0;

  if (poprve == 1) {
    g_HDChlavnihookna=pDC->m_hDC; poprve=0;
   }

  pDC->SetTextColor(VRAT_BARVU_TEXTU(pWnd->m_hWnd));   //nastaveni barvy textu
  pDC->SetBkMode(TRANSPARENT);

/*
  pDC->SetBkColor(g_barvapozadizadavanivety);
  pDC->SetTextColor(g_barvatextucloveka);   //nastaveni barvy textu
  return g_stetecpozadizadavanivety;
*///!

  if (nCtlColor == CTLCOLOR_EDIT || nCtlColor == CTLCOLOR_MSGBOX) {
    if (g_nastaveni.prikaz_nezobrazovatpozadi == 1) //bez pozadi editu
     pDC->SetTextColor(0x000000);     //cerny text
    else pDC->SetTextColor(g_barvatextucloveka);   //nastaveni barvy textu
    pDC->SetBkColor(g_barvapozadizadavanivety);
    return g_stetecpozadizadavanivety;
   }

  return g_stetecpozadihlavnihookna;
 }

HBRUSH CAboutDlg::OnCtlColor(CDC* pDC, CWnd* pWnd, UINT nCtlColor) {
	
  if ((pWnd->m_hWnd) == m_HWNDpodekovani) return g_stetecbilepozadi;
  if ((pWnd->m_hWnd) == m_HWNDwwwadresy) pDC->SetTextColor(0x00FF0000);
  pDC->SetBkMode(TRANSPARENT);
  return g_stetecpozadipodokna;
 }

void CMfcDlg::OnZmenaEdituVety() {
/*static LPTSTR tuknuti=NULL;
  if (tuknuti == NULL) tuknuti=MAKEINTRESOURCE(IDR_ZVUK_TUKNUTI);
  if (g_nastaveni.pouzivatzvuky == 1 && g_tuknuti.aktualnipocetzvuku > 0) {
    PlaySound(g_tuknuti.zvuky[rand()%g_tuknuti.aktualnipocetzvuku], g_instanceprogramu, SND_ASYNC | SND_MEMORY);
   }*/
 }

void CMfcDlg::OnZlepseniNalady() {
	if (g_nastaveni.nalada > 1) {
    g_nastaveni.nalada--;
    g_nastaveni.SPOCITEJ_NALADABODY_Z_NALADY();
    ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI();
   }
 }

void CMfcDlg::OnZhorseniNalady() {
	if (g_nastaveni.nalada < 5) {
    g_nastaveni.nalada++;
    g_nastaveni.SPOCITEJ_NALADABODY_Z_NALADY();
    ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI();
   }
 }

void CMfcDlg::OnZhorseniCharakteru() {
	if (g_nastaveni.charakter < 6) {
    g_nastaveni.charakter++;
    ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI();
   }
 }

void CMfcDlg::OnZlepseniCharakteru() {
	if (g_nastaveni.charakter > 0) {
    g_nastaveni.charakter--;
    ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI();
   }
 }

void CMfcDlg::OnSize(UINT nType, int cx, int cy) {
static BYTE poprve=1;

  CDialog::OnSize(nType, cx, cy);

  if (poprve == 1) PREKRESLI_PRVKY_V_OKNE_PRI_ZMENE_VELIKOSTI(cx,cy);
                          //pouze zapsani si pocatecnich rozmeru

  else PREKRESLI_PRVKY_V_OKNE_PRI_ZMENE_VELIKOSTI(0,0);
                      //opravdova zmena velikosti, rozmery si vypocita

  poprve=0;
 }

void CMfcDlg::OnGetMinMaxInfo(MINMAXINFO FAR* lpMMI) {
      //minimální rozmìry okna, do jakıch ho mùe èlovìk zmenšit
	lpMMI->ptMinTrackSize.x=400;
  lpMMI->ptMinTrackSize.y=220;

	CDialog::OnGetMinMaxInfo(lpMMI);
 }

BOOL CMfcDlg::OnQueryEndSession() {
/*	if (!CDialog::OnQueryEndSession())
		return FALSE;*/

  g_zavritvlaknoprocesu=1;
  PostMessage(WM_CLOSE,0,0);
	return TRUE;
 }

void CMfcDlg::OnJdiNaStrankyOIQPokydu() {
  JDI_NA_WWW_STRANKU("http://iqpokyd.kyblsoft.cz");
 }

void CAboutDlg::OnKliknutiNaInternet() {
  JDI_NA_WWW_STRANKU("http://iqpokyd.kyblsoft.cz");
 }

void CMfcDlg::OnSetfocusVeta() {
  if (g_nastaveni.standardnikurzor == 0) ::CreateCaret(GetDlgItem(IDC_VETA)->m_hWnd,LoadBitmap(g_instanceprogramu,MAKEINTRESOURCE(IDB_KURZORKLAVESNICE)),0,0);
  ::ShowCaret(GetDlgItem(IDC_VETA)->m_hWnd);
 }

void CMfcDlg::OnKillfocusVeta() {
  if (g_nastaveni.standardnikurzor == 0) DestroyCaret();
  ::HideCaret(GetDlgItem(IDC_VETA)->m_hWnd);
 }
