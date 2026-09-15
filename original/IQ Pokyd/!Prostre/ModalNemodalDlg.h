#if !defined(AFX_MODALNEMODALDLG_H__ED8686E1_E506_11D7_8EFC_F8B71745E14D__INCLUDED_)
#define AFX_MODALNEMODALDLG_H__ED8686E1_E506_11D7_8EFC_F8B71745E14D__INCLUDED_

#if _MSC_VER > 1000
#pragma once
#endif // _MSC_VER > 1000
// ModalNemodalDlg.h : header file
//

/////////////////////////////////////////////////////////////////////////////
// CModalNemodalDlg dialog

class CModalNemodalDlg : public CDialog
{
// Construction
public:
	CModalNemodalDlg(CWnd* pParent = NULL);    // standardni konstruktor
	~CModalNemodalDlg(void);                   // standardni destruktor

// Dialog Data
	//{{AFX_DATA(CModalNemodalDlg)
	enum { IDD = IDD_MODAL_NEMODAL };
		// NOTE: the ClassWizard will add data members here
	//}}AFX_DATA


// Overrides
	// ClassWizard generated virtual function overrides
	//{{AFX_VIRTUAL(CModalNemodalDlg)
	protected:
	virtual void DoDataExchange(CDataExchange* pDX);    // DDX/DDV support
	//}}AFX_VIRTUAL

// Implementation
protected:

	// Generated message map functions
	//{{AFX_MSG(CModalNemodalDlg)
		// NOTE: the ClassWizard will add member functions here
	//}}AFX_MSG
	DECLARE_MESSAGE_MAP()
};

//{{AFX_INSERT_LOCATION}}
// Microsoft Visual C++ will insert additional declarations immediately before the previous line.

#endif // !defined(AFX_MODALNEMODALDLG_H__ED8686E1_E506_11D7_8EFC_F8B71745E14D__INCLUDED_)
