import { MutableRefObject } from 'react'

import { Reason, transition } from '../components/transitions/utils/transition'
import { disposables } from '../utils/disposables'
import { match } from '../utils/match'

import { useDisposables } from './use-disposables'
import { useEvent } from './use-event'
import { useIsMounted } from './use-is-mounted'
import { useIsoMorphicEffect } from './use-iso-morphic-effect'
import { useLatestValue } from './use-latest-value'

interface TransitionArgs {
  container: MutableRefObject<HTMLElement | null>
  classes: MutableRefObject<{
    enter: string[]
    enterFrom: string[]
    enterTo: string[]

    leave: string[]
    leaveFrom: string[]
    leaveTo: string[]

    entered: string[]
  }>
  events: MutableRefObject<{
    beforeEnter: () => void
    afterEnter: () => void
    beforeLeave: () => void
    afterLeave: () => void
  }>
  direction: 'enter' | 'leave' | 'idle'
  onStart: MutableRefObject<(direction: TransitionArgs['direction']) => void>
  onStop: MutableRefObject<(direction: TransitionArgs['direction']) => void>
}

export function useTransition({
  container,
  direction,
  classes,
  events,
  onStart,
  onStop,
}: TransitionArgs) {
  let mounted = useIsMounted()
  let d = useDisposables()

  let latestDirection = useLatestValue(direction)

  let beforeEvent = useEvent(() => {
    return match(latestDirection.current, {
      enter: () => events.current.beforeEnter(),
      leave: () => events.current.beforeLeave(),
      idle: () => {},
    })
  })

  let afterEvent = useEvent(() => {
    return match(latestDirection.current, {
      enter: () => events.current.afterEnter(),
      leave: () => events.current.afterLeave(),
      idle: () => {},
    })
  })

  useIsoMorphicEffect(() => {
    let dd = disposables()
    d.add(dd.dispose)

    let node = container.current
    if (!node) return // We don't have a DOM node (yet)
    if (latestDirection.current === 'idle') return // We don't need to transition
    if (!mounted.current) return

    dd.add(() => {
      if (!node) return

      let rect = node.getBoundingClientRect()

      if (rect.x === 0 && rect.y === 0 && rect.width === 0 && rect.height === 0) {
        // The node is completely hidden
        onStop.current(latestDirection.current)
      }
    })

    dd.dispose()

    beforeEvent()

    onStart.current(latestDirection.current)

    dd.add(
      transition(node, classes.current, latestDirection.current === 'enter', (reason) => {
        dd.dispose()

        match(reason, {
          [Reason.Ended]() {
            afterEvent()
            onStop.current(latestDirection.current)
          },
          [Reason.Cancelled]: () => {},
        })
      })
    )

    return dd.dispose
  }, [direction])
}
