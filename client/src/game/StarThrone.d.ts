export interface StarThroneConfig {
  [key: string]: any;
}

export default class StarThrone {
  constructor(config: StarThroneConfig);
  init(): void;
  cleanup(): void;
}
