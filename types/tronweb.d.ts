declare module 'tronweb' {
  export default class TronWeb {
    constructor(options: any);
    static providers: any;
    trx: any;
    contract: any;
    utils: any;
    // Add other necessary TronWeb properties as needed
  }
}