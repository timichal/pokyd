// Nacitani.cpp : implementation file
//

#include "stdafx.h"
#include "IQPokyd.h"
#include "Nacitani.h"
#include "\!iqpokyd\!Zdrojak\aplikace\hlavicky.in"

#ifdef _DEBUG
#define new DEBUG_NEW
#undef THIS_FILE
static char THIS_FILE[] = __FILE__;
#endif

/////////////////////////////////////////////////////////////////////////////
// CNacitani dialog


CNacitani::CNacitani(CWnd* pParent /*=NULL*/)
	: CDialog(CNacitani::IDD, pParent) {
	//{{AFX_DATA_INIT(CNacitani)
		// NOTE: the ClassWizard will add member initialization here
	//}}AFX_DATA_INIT
 }

CNacitani::~CNacitani(void) {
  if (IsWindow(m_hWnd)) DestroyWindow();
 }

void CNacitani::DoDataExchange(CDataExchange* pDX) {
	CDialog::DoDataExchange(pDX);
	//{{AFX_DATA_MAP(CNacitani)
		// NOTE: the ClassWizard will add DDX and DDV calls here
	//}}AFX_DATA_MAP
}


BEGIN_MESSAGE_MAP(CNacitani, CDialog)
	//{{AFX_MSG_MAP(CNacitani)
	ON_WM_HELPINFO()
	ON_WM_CTLCOLOR()
	//}}AFX_MSG_MAP
END_MESSAGE_MAP()

/////////////////////////////////////////////////////////////////////////////
// CNacitani message handlers

void CNacitani::OnCancel() {
  if (g_bezivlaknoprocesu == 1 || g_bezivlaknoprocent == 1) {
    if (g_zavritvlaknoprocesu == 1
     || MessageBox("Chceš ukonèit program IQ Pokyd? (Jestli tohle nedodìlám, nic jiného mi nezbývá.)","IQ Pokyd - Upozornìní",MB_ICONINFORMATION | MB_YESNO | MB_SYSTEMMODAL) == IDYES) {
      g_zavritvlaknoprocesu=1; g_zavritvlaknoprocent=1;
      g_zavritvlaknohlasek=1; g_zavritvlaknoefektu=1;
      for (int i=0; i < 5; i++) {
        if (g_bezivlaknoprocesu == 0 && g_bezivlaknoprocent == 0
         && g_bezivlaknohlasek == 0 && g_bezivlaknoefektu == 0) break;
        Sleep(50);
       }
      g_nestandardniukonceni=1;
      CDialog::OnCancel();
      AfxGetMainWnd()->SendMessage(WM_CLOSE);
     }
   }
  else {
    CDialog::OnCancel();
   }
 }

BOOL CNacitani::OnHelpInfo(HELPINFO* pHelpInfo) {
  return TRUE;
	
//	return CDialog::OnHelpInfo(pHelpInfo);
}

HBRUSH CNacitani::OnCtlColor(CDC* pDC, CWnd* pWnd, UINT nCtlColor) {
  pDC->SetBkMode(TRANSPARENT);
  return g_stetecpozadipodokna;
 }
