import { createBrowserRouter } from 'react-router'

import { Audiences } from '~/Audiences'
import { Calendar } from '~/Calendar'
import { Callback } from '~/callback'
import { Campaigns } from '~/Campaigns'
import { Frame } from '~/frame'
import { Overview } from '~/Overview'
import { Promos } from '~/Promos'
import { Root } from '~/root'
import { Sequence } from '~/Sequence'
import { Sequences } from '~/Sequences'
import { Suppressions } from '~/Suppressions'

/** Every screen, once. The sidebar reads the same table. */
export const SCREENS = [
  { path: '/', label: 'Overview', element: <Overview /> },
  { path: '/sequences', label: 'Sequences', element: <Sequences /> },
  { path: '/audiences', label: 'Audiences', element: <Audiences /> },
  { path: '/campaigns', label: 'Campaigns', element: <Campaigns /> },
  { path: '/calendar', label: 'Calendar', element: <Calendar /> },
  { path: '/promos', label: 'Promos', element: <Promos /> },
  { path: '/opt-outs', label: 'Opt-outs', element: <Suppressions /> },
] as const

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/auth/callback', element: <Callback /> },
      {
        element: <Frame />,
        children: [
          ...SCREENS.map(({ path, element }) => ({ path, element })),
          { path: '/sequences/:id', element: <Sequence /> },
          { path: '*', element: <Overview /> },
        ],
      },
    ],
  },
])
