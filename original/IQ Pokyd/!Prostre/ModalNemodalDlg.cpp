// ModalNemodalDlg.cpp : implementation file
//

#include "stdafx.h"
#include "IQPokyd.h"
#include "ModalNemodalDlg.h"

#ifdef _DEBUG
#define new DEBUG_NEW
#undef THIS_FILE
static char THIS_FILE[] = __FILE__;
#endif

/////////////////////////////////////////////////////////////////////////////
// CModalNemodalDlg dialog


CModalNemodalDlg::CModalNemodalDlg(CWnd* pParent /*=NULL*/)
	: CDialog(CModalNemodalDlg::IDD, pParent)
{
	//{{AFX_DATA_INIT(CModalNemodalDlg)
		// NOTE: the ClassWizard will add member initialization here
	//}}AFX_DATA_INIT
}

CModalNemodalDlg::~CModalNemodalDlg(void) {
  if (IsWindow(m_hWnd)) DestroyWindow();
 }

void CModalNemodalDlg::DoDataExchange(CDataExchange* pDX)
{
	CDialog::DoDataExchange(pDX);
	//{{AFX_DATA_MAP(CModalNemodalDlg)
		// NOTE: the ClassWizard will add DDX and DDV calls here
	//}}AFX_DATA_MAP
}

BEGIN_MESSAGE_MAP(CModalNemodalDlg, CDialog)
	//{{AFX_MSG_MAP(CModalNemodalDlg)
		// NOTE: the ClassWizard will add message map macros here
	//}}AFX_MSG_MAP
END_MESSAGE_MAP()

/////////////////////////////////////////////////////////////////////////////
// CModalNemodalDlg message handlers
