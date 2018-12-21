import * as React from "react";
import styled from "styled-components";

import Blockie from "./Blockie";
import { ellipseAddress, getChainData } from "../helpers/utilities";
import { fonts, responsive, transitions } from "../styles";

const SHeader = styled.div`
  margin-top: -1px;
  margin-bottom: 1px;
  width: 100%;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  @media screen and (${responsive.sm.max}) {
    font-size: ${fonts.size.small};
  }
`;

const SActiveAccount = styled.div`
  display: flex;
  align-items: center;
  position: relative;
  font-weight: 500;
`;

const SActiveChain = styled(SActiveAccount)`
  flex-direction: column;
  text-align: left;
  align-items: flex-start;
  & p {
    font-size: 0.8em;
    margin: 0;
    padding: 0;
  }
  & p:nth-child(2) {
    font-weight: bold;
  }
`;

const SAddresss = styled.p`
  font-weight: bold;
`;

const SDisconnect = styled.div`
  transition: ${transitions.button};
  font-size: 12px;
  font-family: monospace;
  position: absolute;
  right: 0;
  top: 30px;
  opacity: 0.7;
  cursor: pointer;

  &:hover {
    transform: translateY(-1px);
    opacity: 0.5;
  }
`;

interface IHeaderProps {
  killSession: () => void;
  connected: boolean;
  address: string;
  chainId: number;
}

const Header = (props: IHeaderProps) => {
  const { connected, address, chainId, killSession } = props;
  const activeChain = chainId ? getChainData(chainId).name : null;
  return (
    <SHeader {...props}>
      {activeChain && (
        <SActiveChain>
          <p>{`Connected to`}</p>
          <p>{activeChain}</p>
        </SActiveChain>
      )}
      {address && (
        <SActiveAccount>
          <Blockie address={address} />
          <SAddresss>{ellipseAddress(address)}</SAddresss>
          {connected && (
            <SDisconnect onClick={killSession}>{"Disconnect"}</SDisconnect>
          )}
        </SActiveAccount>
      )}
    </SHeader>
  );
};

export default Header;
