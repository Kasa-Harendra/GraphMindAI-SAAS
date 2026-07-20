declare module "react-graph-vis" {
  import { Component } from "react";
  import { Network, Options } from "vis-network";

  export interface GraphProps {
    graph: {
      nodes: any[];
      edges: any[];
    };
    options?: Options;
    events?: any;
    getNetwork?: (network: Network) => void;
    style?: React.CSSProperties;
    getNodes?: (nodes: any) => void;
    getEdges?: (edges: any) => void;
  }

  export default class Graph extends Component<GraphProps> {}
}
