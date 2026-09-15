// mfcDlg.h : header file
//

#if !defined(AFX_MFCDLG_H__B5B06BA7_E47A_11D7_8EFC_E8CBC9D0E14C__INCLUDED_)
#define AFX_MFCDLG_H__B5B06BA7_E47A_11D7_8EFC_E8CBC9D0E14C__INCLUDED_

#if _MSC_VER > 1000
#pragma once
#endif // _MSC_VER > 1000

/////////////////////////////////////////////////////////////////////////////
// CMfcDlg dialog

#include "modalnemodaldlg.h"
#include "nacitani.h"
#include "nastaveni.h"
#include "text.h"

class CMfcDlg : public CDialog
{
// Construction
public:
  CToolTipCtrl m_oNapoveda;
  HICON m_hIcon16;
  HICON m_hIcon32;
  CFont m_oFont1;
  CFont m_oFont2;
  CFont *m_hlavnifont;
  CStatic *policka[100];

	CMfcDlg(CWnd* pParent = NULL);  // standardni konstruktor
	~CMfcDlg(void);                 // standardni destruktor
	CNacitani* pDlg; // ukazatel na tøídu modálního/nemodálního dialogu
  WNDPROC oldProc;

  void NactiSlovniky(void);

// Dialog Data
	//{{AFX_DATA(CMfcDlg)
	enum { IDD = IDD_HLAVNI_OKNO };
	CString m_vetacloveka;
	//}}AFX_DATA

	// ClassWizard generated virtual function overrides
	//{{AFX_VIRTUAL(CMfcDlg)
//	protected:
	virtual void DoDataExchange(CDataExchange* pDX);	// DDX/DDV support
	//}}AFX_VIRTUAL

// Implementation

	// Generated message map functions
	//{{AFX_MSG(CMfcDlg)
	virtual BOOL OnInitDialog();
	afx_msg void OnSysCommand(UINT nID, LPARAM lParam);
	afx_msg void OnPaint();
	afx_msg HCURSOR OnQueryDragIcon();
	afx_msg void OnNovaVeta();
	afx_msg void OnClose();
	afx_msg void OnNastaveni();
	afx_msg void OnAbout();
	afx_msg void OnMenuClose();
	afx_msg BOOL OnHelpInfo(HELPINFO* pHelpInfo);
	afx_msg void OnOverzi();
	afx_msg void OnZkratkaSmazradek();
	afx_msg void OnPredchoziveta();
	afx_msg void OnCheatDebugInfo();
	afx_msg void OnMalaNapoveda();
	afx_msg void OnVelkaNapoveda();
	afx_msg HBRUSH OnCtlColor(CDC* pDC, CWnd* pWnd, UINT nCtlColor);
	afx_msg void OnZmenaEdituVety();
	afx_msg void OnZlepseniNalady();
	afx_msg void OnZhorseniNalady();
	afx_msg void OnZhorseniCharakteru();
	afx_msg void OnZlepseniCharakteru();
	afx_msg void OnSize(UINT nType, int cx, int cy);
	afx_msg void OnGetMinMaxInfo(MINMAXINFO FAR* lpMMI);
	afx_msg BOOL OnQueryEndSession();
	afx_msg void OnJdiNaStrankyOIQPokydu();
	afx_msg void OnSetfocusVeta();
	afx_msg void OnKillfocusVeta();
	//}}AFX_MSG
	DECLARE_MESSAGE_MAP()

};

//{{AFX_INSERT_LOCATION}}
// Microsoft Visual C++ will insert additional declarations immediately before the previous line.

#endif // !defined(AFX_MFCDLG_H__B5B06BA7_E47A_11D7_8EFC_E8CBC9D0E14C__INCLUDED_)
