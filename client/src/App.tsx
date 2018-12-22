import * as React from "react";
import styled from "styled-components";

import WalletConnect from "./lib/walletconnect";

import Button from "./components/Button";
import Card from "./components/Card";
import Header from "./components/Header";
import PeerMeta from "./components/PeerMeta";
import Dropdown from "./components/Dropdown";
import AccountDetails from "./components/AccountDetails";
import QRCodeDisplay from "./components/QRCodeDisplay";
import QRCodeScanner, {
  IQRCodeValidateResponse
} from "./components/QRCodeScanner";

import { ITxData, IChainData } from "./helpers/types";
import { apiGetGasPrices, apiGetAccountNonce } from "./helpers/api";
import { isMobile, sanitizeHex, getChainData } from "./helpers/utilities";
import {
  convertAmountToRawNumber,
  convertStringToHex
} from "./helpers/bignumber";
import chains from "./helpers/chains";

const SContainer = styled.div`
  display: flex;
  flex-direction: column;

  width: 100%;
  height: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: 0;
`;

const SColumn = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
`;

const SContent = styled.div`
  width: 100%;
  flex: 1;
  padding: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const STitle = styled.h1`
  margin: 10px auto 20px;
  text-align: center;
  font-size: calc(10px + 2vmin);
`;

const SActions = styled.div`
  margin: 20px auto;
  display: flex;
  justify-content: space-around;
  & > * {
    margin: 0 5px;
  }
`;

interface IAppState {
  loading: boolean;
  mobile: boolean;
  scanner: boolean;
  walletConnector: WalletConnect | null;
  uri: string;
  peerMeta: {
    description: string;
    url: string;
    icons: string[];
    name: string;
    ssl: boolean;
  };
  connected: boolean;
  chainId: number;
  chainData: IChainData;
  accounts: string[];
  address: string;
  requests: any[];
  results: any[];
}

const testAccounts = [
  {
    address: "0x6e4d387c925a647844623762aB3C4a5B3acd9540",
    privateKey:
      "c13d25f6ad00f532b530d75bf3a5f16b8e11e5619bc9b165a6ac99b150a2f456"
  },
  {
    address: "0xeF8fD2BDC6F6Be83F92054F8Ecd6B010f28CE7F4",
    privateKey:
      "67543bed4cc767d6153daf55547c5fa751657dab953d4bc01846c7a6a4fc4782"
  }
];

const defaultChainId = 3;

const INITIAL_STATE = {
  scanner: false,
  walletConnector: null,
  uri: "",
  peerMeta: {
    description: "",
    url: "",
    icons: [],
    name: "",
    ssl: false
  },
  connected: false,
  chainId: defaultChainId,
  chainData: getChainData(defaultChainId),
  accounts: [],
  address: "",
  requests: [],
  results: []
};

class App extends React.Component<{}> {
  public state: IAppState;

  constructor(props: any) {
    super(props);
    this.state = {
      loading: false,
      mobile: isMobile(),
      ...INITIAL_STATE
    };
  }
  public componentDidMount() {
    this.initApp();
  }

  public initApp = () => {
    if (!this.state.mobile) {
      this.initWalletConnect();
    } else {
      this.initWallet();
    }
  };

  public initWalletConnect = async () => {
    const { uri } = this.state;

    this.setState({ loading: true });

    try {
      const node = this.generateTestNodeUrl();

      const opts = uri ? { uri } : { node };

      const walletConnector = new WalletConnect(opts);

      window.walletConnector = walletConnector; // tslint:disable-line

      if (!walletConnector.connected) {
        await walletConnector.createSession();
      }

      await this.setState({
        loading: false,
        walletConnector,
        uri: walletConnector.uri
      });

      this.subscribeToEvents();
    } catch (error) {
      this.setState({ loading: false });

      throw error;
    }
  };

  public initWallet = async () => {
    this.generateTestAccounts();

    const local = localStorage ? localStorage.getItem("wcsmngt") : null;

    if (local) {
      let session;

      try {
        session = JSON.parse(local);
      } catch (error) {
        throw error;
      }

      const walletConnector = new WalletConnect({ session });

      const { connected, chainId, peerMeta } = walletConnector;

      const chainData = getChainData(chainId);

      await this.setState({
        connected,
        walletConnector,
        chainId,
        chainData,
        peerMeta
      });

      this.subscribeToEvents();
    }
  };

  public approveSession = () => {
    const { walletConnector, chainId, accounts } = this.state;
    if (walletConnector) {
      walletConnector.approveSession({ chainId, accounts });
    }
    this.setState({ walletConnector });
  };

  public rejectSession = () => {
    const { walletConnector } = this.state;
    if (walletConnector) {
      walletConnector.rejectSession();
    }
    this.setState({ walletConnector });
  };

  public killSession = () => {
    const { walletConnector } = this.state;
    if (walletConnector) {
      walletConnector.killSession();
    }
    this.resetApp();
  };

  public resetApp = async () => {
    await this.setState({ ...INITIAL_STATE });
    this.initApp();
  };

  public sendTransaction = async () => {
    const { walletConnector, address, chainData } = this.state;
    let { results } = this.state;

    if (walletConnector && chainData) {
      const nonceRes = await apiGetAccountNonce(address, chainData);
      const nonce = nonceRes.data.result;
      const gasPrices = await apiGetGasPrices();
      const gasPriceRaw = gasPrices.slow.price;
      const gasPrice = sanitizeHex(
        convertStringToHex(convertAmountToRawNumber(gasPriceRaw, 9))
      );
      const gasLimitRaw = 21000;
      const gasLimit = sanitizeHex(convertStringToHex(gasLimitRaw));

      const tx: ITxData = {
        from: address,
        to: address,
        nonce,
        gasPrice,
        gasLimit,
        value: "0x00",
        data: "0x"
      };

      const result = await walletConnector.sendTransaction(tx);
      results = [...results, result];
    }
    this.setState({ walletConnector, results });
  };

  public signTypedData = async () => {
    const { walletConnector, address, chainId } = this.state;
    let { results } = this.state;

    if (walletConnector) {
      const msgParams = [
        address,
        {
          types: {
            EIP712Domain: [
              { name: "name", type: "string" },
              { name: "version", type: "string" },
              { name: "chainId", type: "uint256" },
              { name: "verifyingContract", type: "address" }
            ],
            Person: [
              { name: "name", type: "string" },
              { name: "account", type: "address" }
            ],
            Mail: [
              { name: "from", type: "Person" },
              { name: "to", type: "Person" },
              { name: "contents", type: "string" }
            ]
          },
          primaryType: "Mail",
          domain: {
            name: "Example Dapp",
            version: "0.7.0",
            chainId,
            verifyingContract: "0x0000000000000000000000000000000000000000"
          },
          message: {
            from: {
              name: "Alice",
              account: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            },
            to: {
              name: "Bob",
              account: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            },
            contents: "Hey, Bob!"
          }
        }
      ];
      const result = await walletConnector.signTypedData(msgParams);
      results = [...results, result];
    }
    this.setState({ walletConnector, results });
  };

  public signMessage = async () => {
    const { walletConnector, accounts } = this.state;
    let { results } = this.state;

    if (walletConnector) {
      const address = accounts[0];
      const msgParams = [address, "My email is john@doe.com - 1537836206101"];
      const result = await walletConnector.signMessage(msgParams);
      results = [...results, result];
    }
    this.setState({ walletConnector, results });
  };

  public generateTestAccounts = () => {
    const accounts = testAccounts.map(account => account.address);
    const address = accounts[0];
    this.setState({ accounts, address });
  };

  public generateTestNodeUrl(): string {
    const host: string = window.location.host;
    const protocol: string = window.location.href.startsWith("https")
      ? "wss"
      : "ws";
    const url: string = `${protocol}://${
      process.env.NODE_ENV === "development" ? "localhost:5000" : host
    }`;
    return url;
  }

  public subscribeToEvents = () => {
    const { walletConnector } = this.state;

    if (walletConnector) {
      walletConnector.on("session_request", (error, payload) => {
        console.log('walletConnector.on("session_request")'); // tslint:disable-line

        if (error) {
          throw error;
        }

        const { peerMeta } = payload.params[0];
        this.setState({ peerMeta });
      });

      walletConnector.on("session_update", (error, payload) => {
        console.log('walletConnector.on("session_update")'); // tslint:disable-line

        if (error) {
          throw error;
        }

        const { chainId, accounts } = payload.params[0];
        const address = accounts[0];
        const chainData = getChainData(chainId);
        this.setState({ chainId, accounts, address, chainData });
      });

      walletConnector.on("call_request", (error, payload) => {
        console.log('walletConnector.on("call_request")'); // tslint:disable-line

        if (error) {
          throw error;
        }

        const requests = [...this.state.requests, payload];
        this.setState({ requests });
      });

      walletConnector.on("connect", (error, payload) => {
        console.log('walletConnector.on("connect")'); // tslint:disable-line

        if (error) {
          throw error;
        }

        const { chainId, accounts } = payload.params[0];
        const address = accounts[0];
        const chainData = getChainData(chainId);
        this.setState({
          connected: true,
          chainId,
          accounts,
          address,
          chainData
        });
      });

      walletConnector.on("disconnect", (error, payload) => {
        console.log('walletConnector.on("disconnect")'); // tslint:disable-line

        if (error) {
          throw error;
        }

        this.resetApp();
      });

      if (walletConnector.connected) {
        const { chainId, accounts } = walletConnector;
        const address = accounts[0];
        const chainData = getChainData(chainId);
        this.setState({
          connected: true,
          chainId,
          accounts,
          address,
          chainData
        });
      }

      this.setState({ walletConnector });
    }
  };

  public updateSession = async (sessionParams: {
    chainId?: number;
    accounts?: string[];
  }) => {
    const { walletConnector, chainId, accounts } = this.state;
    const _chainId = sessionParams.chainId || chainId;
    const _accounts = sessionParams.accounts || accounts;
    if (walletConnector) {
      walletConnector.updateSession({
        chainId: _chainId,
        accounts: _accounts
      });
    }

    await this.setState({
      walletConnector,
      chainId: _chainId,
      accounts: _accounts
    });
  };

  public updateChain = async (chainId: number | string) => {
    const { mobile } = this.state;
    const _chainId = Number(chainId);
    if (mobile) {
      this.updateSession({ chainId: _chainId });
    }
  };

  public toggleScanner = () => {
    this.setState({ scanner: !this.state.scanner });
  };

  public onQRCodeValidate = (data: string): IQRCodeValidateResponse => {
    const res: IQRCodeValidateResponse = {
      error: null,
      result: null
    };
    try {
      res.result = data;
    } catch (error) {
      res.error = error;
    }

    return res;
  };

  public onQRCodeScan = async (data: any) => {
    const uri = typeof data === "string" ? data : "";
    if (uri) {
      await this.setState({ uri });
      await this.initWalletConnect();
      this.toggleScanner();
    }
  };

  public onQRCodeError = (error: Error) => {
    throw error;
  };

  public onQRCodeClose = () => this.toggleScanner();

  public render() {
    const {
      loading,
      mobile,
      uri,
      peerMeta,
      scanner,
      connected,
      accounts,
      address,
      chainId,
      requests
    } = this.state;
    return (
      <SContainer>
        <Header
          connected={connected}
          address={address}
          chainId={chainId}
          killSession={this.killSession}
        />
        <SContent>
          {mobile ? (
            <Card maxWidth={400}>
              <STitle>{`Wallet`}</STitle>
              {!connected ? (
                peerMeta.name ? (
                  <SColumn>
                    <PeerMeta peerMeta={peerMeta} />
                    <SActions>
                      <Button onClick={this.approveSession}>{`Approve`}</Button>
                      <Button onClick={this.rejectSession}>{`Reject`}</Button>
                    </SActions>
                  </SColumn>
                ) : (
                  <SColumn>
                    <AccountDetails accounts={accounts} />
                    <div>
                      <h6>{"Network"}</h6>
                      <Dropdown
                        disabled={!mobile}
                        selected={chainId}
                        options={chains}
                        displayKey={"name"}
                        targetKey={"chain_id"}
                        onChange={this.updateChain}
                      />
                    </div>

                    <SActions>
                      <Button onClick={this.toggleScanner}>{`Scan`}</Button>
                    </SActions>
                  </SColumn>
                )
              ) : (
                <SColumn>
                  <AccountDetails accounts={accounts} />
                  <div>
                    <h6>{"Network"}</h6>
                    <Dropdown
                      disabled={!mobile}
                      selected={chainId}
                      options={chains}
                      displayKey={"name"}
                      targetKey={"chain_id"}
                      onChange={this.updateChain}
                    />
                  </div>

                  {peerMeta.name && (
                    <>
                      <h6>{"Connected to"}</h6>
                      <div>{peerMeta.name}</div>
                    </>
                  )}
                  <h6>{"Pending Call Requests"}</h6>
                  {!!requests.length ? (
                    requests.map(request => (
                      <div key={request.id}>
                        <div>{request.method}</div>
                      </div>
                    ))
                  ) : (
                    <div>
                      <div>{"No pending requests"}</div>
                    </div>
                  )}
                </SColumn>
              )}
            </Card>
          ) : (
            <Card maxWidth={400}>
              <STitle>{`Dapp`}</STitle>
              {!loading ? (
                uri ? (
                  connected ? (
                    <SColumn>
                      <AccountDetails accounts={accounts} />
                      <div>
                        <h6>{"Network"}</h6>
                        <Dropdown
                          disabled={!mobile}
                          selected={chainId}
                          options={chains}
                          displayKey={"name"}
                          targetKey={"chain_id"}
                          onChange={this.updateChain}
                        />
                      </div>

                      <SActions>
                        <Button
                          onClick={this.sendTransaction}
                        >{`Send Transaction`}</Button>
                        <Button
                          onClick={this.signMessage}
                        >{`Sign Message`}</Button>
                        <Button
                          onClick={this.signTypedData}
                        >{`Sign Typed Data`}</Button>
                      </SActions>
                    </SColumn>
                  ) : (
                    <QRCodeDisplay data={uri} />
                  )
                ) : (
                  <span>{`missing uri`}</span>
                )
              ) : (
                <span>{`loading`}</span>
              )}
            </Card>
          )}
        </SContent>
        {scanner && (
          <QRCodeScanner
            onValidate={this.onQRCodeValidate}
            onScan={this.onQRCodeScan}
            onError={this.onQRCodeError}
            onClose={this.onQRCodeClose}
          />
        )}
      </SContainer>
    );
  }
}

export default App;
