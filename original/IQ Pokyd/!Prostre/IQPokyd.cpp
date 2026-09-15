#include "stdafx.h"
#include "IQPokyd.h"
#include "Nacitani.h"
#include "Nastaveni.h"
#include "mfcDlg.h"
#define IQPOKYDWINMFC 1
#include "\!IQPokyd\!Zdrojak\Aplikace\vsechno.in"

#ifdef _DEBUG
#define new DEBUG_NEW
#undef THIS_FILE
static char THIS_FILE[] = __FILE__;
#endif


//Pro klavesove zkratky
HWND    ghDlg = 0;          // Handle to main dialog box.
HACCEL  ghAccelTable = 0;   // Handle to accelerator table.


/////////////////////////////////////////////////////////////////////////////
// CMfcApp

BEGIN_MESSAGE_MAP(CMfcApp, CWinApp)
	//{{AFX_MSG_MAP(CMfcApp)
		// NOTE - the ClassWizard will add and remove mapping macros here.
		//    DO NOT EDIT what you see in these blocks of generated code!
	//}}AFX_MSG
	ON_COMMAND(ID_HELP, CWinApp::OnHelp)
END_MESSAGE_MAP()

/////////////////////////////////////////////////////////////////////////////
// CMfcApp construction

CMfcApp::CMfcApp()
{
	// TODO: add construction code here,
	// Place all significant initialization in InitInstance
}

/////////////////////////////////////////////////////////////////////////////
// The one and only CMfcApp object

CMfcApp theApp;

BOOL CMfcApp::ProcessMessageFilter(int code, LPMSG lpMsg) {
  if (code < 0)
   CWinApp::ProcessMessageFilter(code, lpMsg);

  if (ghDlg && ghAccelTable) {
    if (::TranslateAccelerator(ghDlg, ghAccelTable, lpMsg)) return(TRUE);
   }

  return CWinApp::ProcessMessageFilter(code, lpMsg);
 }

/////////////////////////////////////////////////////////////////////////////
// CMfcApp initialization

BOOL CMfcApp::InitInstance() {
  InitCommonControls();       //pro Win XP
  AfxEnableControlContainer();

	// Standard initialization
	// If you are not using these features and wish to reduce the size
	//  of your final executable, you should remove from the following
	//  the specific initialization routines you do not need.

#ifdef _AFXDLL
  Enable3dControls();			// Call this when using MFC in a shared DLL
#else
  Enable3dControlsStatic();	// Call this when linking to MFC statically
#endif

  m_pMainWnd = &g_MfcDlghlavniokno;

  AfxInitRichEdit();

  ROZEBER_PRIKAZOVY_RADEK();

  ghAccelTable = LoadAccelerators(AfxGetInstanceHandle(),MAKEINTRESOURCE(IDR_ZKRATKY));
                                       //pro klavesove zkratky

  NASTAV_VIDITELNOST_POZADI(0);

  g_MfcDlghlavniokno.DoModal();

	// Since the dialog has been closed, return FALSE so that we exit the
	//  application, rather than start the application's message pump.
  return FALSE;
 }

BOOL CMfcApp::ExitInstance() {
  return CWinApp::ExitInstance();
 }
