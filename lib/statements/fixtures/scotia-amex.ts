/** Synthetic replica of the Scotiabank AMEX layout (fake data, real shape). */
export const SCOTIA_FIXTURE = `
                                                              RNC 101-04359-8
             Estado de cuenta de:                             Fecha de Corte: 15-07-2026
             CLIENTE FALSO                                    Fecha límite de pago: 10-08-2026

             American Express
             THE PLATINUM CARD METAL
             No. de Tarjeta:
             ***********6760
                     MONEDA             LIMITE DE CREDITO BALANCE AL CORTE PAGO MINIMO AL CORTE
             DOP                                 20,000.00                  800.00                 80.00
             USD                                  1,000.00                   34.98                  5.00
             Cuotas Scotiabank DOP               5,000.00                     0.00                  0.00

             Resumen de Cuenta
                     MONEDA           BALANCE               COMPRAS           INTERESES Y         TOTAL PAGOS            BALANCE PROMEDIO                  BALANCE
                                   CORTE ANTERIOR           Y DEBITOS           CARGOS             Y CREDITOS            MENSUAL DE CAPITAL                AL CORTE
             DOP                                 0.00         1,000.00              300.00              -500.00                       650.00                 800.00
             USD                                  0.00            64.98                0.00               -30.00                        20.00                  34.98
             Cuotas Scotiabank DOP               0.00             0.00                0.00                 0.00                         0.00                   0.00

             Detalle Transacciones en Pesos (DOP)                                    Tasa de Interés Anual DOP: 60%
                  NO. TARJETA               FECHA DE          FECHA DE                                  DETALLE DE
                                                                                                                      DEBITOS Y CREDITOS
                   CREDITO                   TRANS.            POSTEO                                 TRANSACCIONES

                   1169.              26/06/2026.        26/06/2026        CARGO COBERTURA DE SEGURO                       300.00.
                   6760.              27/06/2026.        29/06/2026        TIENDA FALSA UNO, CIUDAD FALSA               1,000.00.
                   1169.              01/07/2026.        01/07/2026        PAGOS TARJETAS ACH                             -500.00.

             Balance al Corte                                                 800.00
             Balance Promedio Diario de Capital del Mes                       650.00
             Balance Promedio Diario de Capital Anterior                        0.00
             Intereses Nuevos Consumos                                         29.57
             Intereses por Financiamiento del Mes                               0.00

             Detalle Transacciones en Dólares (USD)                                  Tasa de Interés Anual USD: 60%
                   6760                 28/06/2026.         30/06/2026         AMAZON MKTPL*FAKE, AMZN.COM/BILL              44.98.
                   6760                 29/06/2026.         30/06/2026         ANTHROPIC* CLAUDE SUB, SAN FRANCISCO          20.00.
                   1177                 06/07/2026.         06/07/2026         PAGO VENTANILLA                              -30.00.

             Balance al Corte                                                  34.98
             Balance Promedio Diario de Capital del Mes                        20.00
             Balance Promedio Diario de Capital Anterior                        0.00
             Intereses Nuevos Consumos                                          1.00
             Intereses por Financiamiento del Mes                               0.00

             Cuotas Scotiabank por facturar
             Scotiabank República Dominicana, S. A., Banco Múltiple - www.scotiabank.com.do
`;
