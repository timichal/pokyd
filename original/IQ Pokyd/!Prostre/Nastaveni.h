#if !defined(AFX_NASTAVENI_H__DEDF8F9C_8DD2_44AE_9BFE_A9FD4D99852A__INCLUDED_)
#define AFX_NASTAVENI_H__DEDF8F9C_8DD2_44AE_9BFE_A9FD4D99852A__INCLUDED_

#if _MSC_VER > 1000
#pragma once
#endif // _MSC_VER > 1000
// Nastaveni.h : header file
//

/////////////////////////////////////////////////////////////////////////////
// CNastaveni dialog

class CNastaveni : public CDialog
{
	CToolTipCtrl m_oNapoveda;
public:
// Construction
	CNastaveni(CWnd* pParent = NULL);   // standard constructor
	~CNastaveni(void);                  // standard destructor

// Dialog Data
	//{{AFX_DATA(CNastaveni)
	enum { IDD = IDD_NASTAVENI };
		// NOTE: the ClassWizard will add data members here
	//}}AFX_DATA


// Overrides
	// ClassWizard generated virtual function overrides
	//{{AFX_VIRTUAL(CNastaveni)
	protected:
    virtual BOOL PreTranslateMessage(MSG* pMsg);
	virtual void DoDataExchange(CDataExchange* pDX);    // DDX/DDV support
	//}}AFX_VIRTUAL

// Implementation
protected:

	// Generated message map functions
	//{{AFX_MSG(CNastaveni)
	afx_msg BOOL OnHelpInfo(HELPINFO* pHelpInfo);
	virtual BOOL OnInitDialog();
	virtual void OnOK();
	afx_msg void OnZobrazovatpopisky();
	afx_msg void OnClose();
	afx_msg void BublinkovaNapoveda();
	afx_msg HBRUSH OnCtlColor(CDC* pDC, CWnd* pWnd, UINT nCtlColor);
	afx_msg void OnRozsireneNastaveni();
	afx_msg void OnZakladniNastaveni();
	afx_msg void OnNastavDisableEmulace();
	//}}AFX_MSG
	DECLARE_MESSAGE_MAP()
};

//{{AFX_INSERT_LOCATION}}
// Microsoft Visual C++ will insert additional declarations immediately before the previous line.

#endif // !defined(AFX_NASTAVENI_H__DEDF8F9C_8DD2_44AE_9BFE_A9FD4D99852A__INCLUDED_)
