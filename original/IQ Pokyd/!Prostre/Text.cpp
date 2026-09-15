// Text.cpp : implementation file
//

#include "stdafx.h"
#include "IQPokyd.h"
#include "Text.h"

#ifdef _DEBUG
#define new DEBUG_NEW
#undef THIS_FILE
static char THIS_FILE[] = __FILE__;
#endif

/////////////////////////////////////////////////////////////////////////////
// CText dialog


CText::CText(CWnd* pParent /*=NULL*/)
	: CDialog(CText::IDD, pParent) {

	//{{AFX_DATA_INIT(CText)
		// NOTE: the ClassWizard will add member initialization here
	//}}AFX_DATA_INIT
 }

CText::~CText(void) {
  if (IsWindow(m_hWnd)) DestroyWindow();
 }

void CText::DoDataExchange(CDataExchange* pDX) {
	CDialog::DoDataExchange(pDX);
	//{{AFX_DATA_MAP(CText)
		// NOTE: the ClassWizard will add DDX and DDV calls here
	//}}AFX_DATA_MAP
 }

BEGIN_MESSAGE_MAP(CText, CDialog)
	//{{AFX_MSG_MAP(CText)
	ON_WM_HELPINFO()
	ON_BN_CLICKED(IDC_BUTTON, OnClose)
	ON_WM_CTLCOLOR()
	//}}AFX_MSG_MAP
END_MESSAGE_MAP()

/////////////////////////////////////////////////////////////////////////////
// CText message handlers

BOOL CText::OnInitDialog() {
char *chartext=ALOKUJ_RETEZEC(text.GetLength()+1);
  CDialog::OnInitDialog();
	
  SetWindowText(nadpis);

  SendDlgItemMessage(IDC_TEXT, EM_SETLANGOPTIONS, 0, 0); //spravne kodovani

  m_HWNDtextu=GetDlgItem(IDC_TEXT)->m_hWnd;
  strcpy(chartext,text);
  NAPIS_FORMATOVANY_TEXT_NAPOVEDY(chartext,m_HWNDtextu);

  UVOLNI(chartext);
  return TRUE;  // return TRUE unless you set the focus to a control
	              // EXCEPTION: OCX Property Pages should return FALSE
 }

BOOL CText::OnHelpInfo(HELPINFO* pHelpInfo) {
  return FALSE;
//  return CDialog::OnHelpInfo(pHelpInfo);
 }

void CText::OnClose() {
  SendMessage(WM_CLOSE);
 }

HBRUSH CText::OnCtlColor(CDC* pDC, CWnd* pWnd, UINT nCtlColor) {
  if ((pWnd->m_hWnd) == m_HWNDtextu) return g_stetecbilepozadi;
  else {
    pDC->SetBkMode(TRANSPARENT);
    return g_stetecpozadipodokna;
   }
 }
