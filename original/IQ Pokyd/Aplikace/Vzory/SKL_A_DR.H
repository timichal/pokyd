/* Tento zdrojový kód je pod licencí GNU/GPL. Mùžete ho použít k vlastní
   potøebì, ale nesmíte jej ani programy založené na tomto kódu využít komerènì!

   Jedná se o zdrojový kód programu IQ Pokyd (http://iqpokyd.kyblsoft.cz)
   od Aleše Jandy
*/

/* IQ Pokyd - skl_a_dr.h - konstanty, definice atd. pro chod IQ Pokydu
   Aleš Janda (C) KÝBLSoft 2002-2005 (kódování Windows 1250)
*/

typedef unsigned char BYTE;
typedef unsigned short WORD;
typedef unsigned long DWORD;

#define UVOLNI(pamet) { UVOLNI_X(pamet); pamet=NULL; }

#define DELKA_JEDNODUCHEHO_SLOVA 60
#define DELKA_FRONTY 500
#define DELKA_INFORMACI 500
#define MAX_POCET_VNORENI_PRI_ROZSKLONOVANI 20

#define DELKA_NALEZENYCH_INFORMACI 5000
#define MAX_POCET_SLOV_CLOVEKA 40
