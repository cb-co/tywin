/** Synthetic replica of the Banco Popular VISA layout (fake data, real shape). */
export const POPULAR_FIXTURE = `
                                                                    ESTADO DE CUENTA
                       LÍNEA DE             CRÉDITO                  FECHA LÍMITE       BALANCE
 VISA TEST
                       CRÉDITO              DISPONIBLE   FECHA DE CORTE   DE PAGO       ANTERIOR
 ****-****-****-1234                     10,000.00      8,574.50        25/06/2026     20/07/2026       1,000.00

       FECHAS DE
                  NO. DE REFERENCIA        CARGOS, PAGOS, CRÉDITOS Y AJUSTES ANTERIORES        CANTIDAD
  ENTRADA    TRANSAC.

  28/05         26/05   74763946147620851045422            MERCADO UNO                    CIUDAD FALSA           500.00
                                                           5411   045602
  01/06         30/05   74589056150016437936842            GASOLINERA DOS                 CIUDAD FALSA           100.00
                                                           5541   082832
  05/06         03/06   0613554270                         Pago via SPE                                         -200.00

  10/06         09/06   74763946155622940137862            RESTAURANTE TRES               CIUDAD FALSA            75.50
                                                           5812   013148
  25/06         25/06   0622199159                         Rebate VISA TEST                                      -50.00

                              UNA CANTIDAD CON EL SIGNO (-) DE MENOS ES UN CRÉDITO.

     CUOTAS
                         MONTO VENCIDO       PAGO MÍNIMO        BALANCE A PAGAR       BALANCE TOTAL
     VENCIDAS
      0                       0.00              142.55              1,425.50             1,425.50

                             Tasa de Interés Anual....: 40.00 %

                             Saldo Promedio Diario de los Consumos del Mes                    1,200.00
                             Interés si Opta Por Financiar los Consumos del Mes                  40.00

                             Saldo Promedio Diario del Capital Pendiente de Meses Anteriores        0.00
                             Interés por Financiamiento del Capital Pendiente de Meses Anteriores   0.00

                              Banco Popular Dominicano, S. A. - Banco Múltiple      Tel. 809-544-5000
                              Av. Falsa #1                                          RNC 101010632
`;

/** December→January wrap: cutoff 10/01/2027, transactions from late December. */
export const POPULAR_WRAP_FIXTURE = `
 VISA TEST
 ****-****-****-1234                     10,000.00      9,700.00        10/01/2027     05/02/2027         0.00

  28/12         27/12   74763946147620851099999            MERCADO UNO                    CIUDAD FALSA           300.00
                                                           5411   045603

     CUOTAS
                         MONTO VENCIDO       PAGO MÍNIMO        BALANCE A PAGAR       BALANCE TOTAL
     VENCIDAS
      0                       0.00               30.00                300.00               300.00

                              Banco Popular Dominicano, S. A. - Banco Múltiple      Tel. 809-544-5000
                              RNC 101010632
`;
