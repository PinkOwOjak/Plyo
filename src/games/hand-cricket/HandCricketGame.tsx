import type { GameProps } from '../../platform/games.ts';
import { GameHome } from './ui/GameHome.tsx';
import { RulesScreen } from './ui/RulesScreen.tsx';
import { BotMatch } from './modes/BotMatch.tsx';
import { LocalMatch } from './modes/LocalMatch.tsx';
import { OnlineScreen } from './modes/OnlineScreen.tsx';
import './hand-cricket.css';

/** Hand Cricket module: owns every route under #/hand-cricket. */
export default function HandCricketGame({ route }: GameProps) {
  const sub = route.path[1] ?? '';
  switch (sub) {
    case 'rules':
      return <RulesScreen next={route.query.get('next')} />;
    case 'bot':
      return <BotMatch query={route.query} />;
    case 'local':
      return <LocalMatch query={route.query} />;
    case 'online':
      return <OnlineScreen query={route.query} />;
    default:
      return <GameHome />;
  }
}
