import { useState, useEffect, useRef } from 'react'

type LineType = 'system' | 'header' | 'warning' | 'message' | 'separator' | 'status' | 'blank'

interface LineConfig {
  text: string
  speed: number
  preDelay: number
  type: LineType
}

const S = (text: string, speed: number, preDelay: number, type: LineType = 'system'): LineConfig =>
  ({ text, speed, preDelay, type })
const B = (preDelay = 200): LineConfig =>
  ({ text: '', speed: 0, preDelay, type: 'blank' })
const SEP = (preDelay = 100): LineConfig =>
  ({ text: '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', speed: 12, preDelay, type: 'separator' })

const LINES: LineConfig[] = [
  S('PLUTO COMMUNICATION SYSTEM',                           35,  800),
  S('REV. 4.1 \u2014 1974',                                35,   80),
  B(300),
  S('POWER ON...',                                          55,  200),
  S('POWER ON...',                                          55,  400),
  S('POWER ON...',                                          55,  400),
  B(200),
  S('MEMORY CHECK ................ 48K / OK',               55,  100),
  S('ROM INTEGRITY ............... PASS',                   55,  100),
  S('CLOCK SYNC .................. FAIL',                   55,  100),
  S('CLOCK SYNC .................. FAIL',                   55,  450),
  S('CLOCK SYNC .................. ESTIMATED \u2014 1974.03.07 / 04:12', 55, 450),
  B(200),
  S('WARNING: SYSTEM DATE UNVERIFIED.',                     45,  200, 'warning'),
  S('PROCEEDING.',                                          80,  300),
  B(300),
  SEP(),
  B(400),
  S('[SEQUENCE 01 \u2014 HARDWARE INIT]',                   35,  200, 'header'),
  B(200),
  S('TAPE DRIVE A ................ READY',                  55,  100),
  S('TAPE DRIVE B ................ NOT FOUND',              55,  100),
  S('TAPE DRIVE B ................ NOT FOUND',              55,  450),
  S('TAPE DRIVE B ................ SKIPPING',               55,  450),
  B(200),
  S('THERMAL SENSOR .............. 31.4\u00b0C / ELEVATED', 55,  100),
  S('COOLING FAN ................. ACTIVATED',              55,  100),
  S('RELAY BOARD ................. OK',                     55,  100),
  S('OUTPUT BUFFER ............... CLEARED',                55,  100),
  B(200),
  S('HARDWARE INIT ............... COMPLETE',               55,  200),
  B(300),
  SEP(),
  B(400),
  S('[SEQUENCE 02 \u2014 TRANSMISSION MODULE]',             35,  200, 'header'),
  B(200),
  S('LOADING TRANSMISSION MODULE...',                       50,  300),
  S('.............................',                         80,  100),
  S('ERROR \u2014 SECTOR 12 CORRUPTED',                     40,  300),
  S('REINITIALIZING................',                        60,  200),
  S('.............................',                         80,  100),
  S('ERROR \u2014 SECTOR 12 CORRUPTED',                     40,  300),
  S('REINITIALIZING................',                        60,  200),
  S('.............................',                         80,  100),
  S('OK',                                                  120,  500),
  B(300),
  S('MODULE VERSION: TX-88 / BUILD 0041',                   40,  200),
  S('LAST USED: UNKNOWN',                                   40,  100),
  S('LAST RECIPIENT: UNKNOWN',                              40,  100),
  B(300),
  SEP(),
  B(400),
  S('[SEQUENCE 03 \u2014 SIGNAL SEARCH]',                   35,  200, 'header'),
  B(200),
  S('SCANNING FREQUENCIES...',                              50,  300),
  S('  062.0 MHz .... NO CARRIER',                          45,  400),
  S('  071.4 MHz .... NO CARRIER',                          45,  400),
  S('  088.6 MHz .... SIGNAL DETECTED \u2014 WEAK',         45,  500),
  S('  088.6 MHz .... SIGNAL DETECTED \u2014 WEAK',         45,  600),
  S('  088.6 MHz .... SIGNAL DETECTED \u2014 STABILIZING',  45,  600),
  B(300),
  S('SIGNAL FREQUENCY LOCKED: 88.6 MHz',                   40,  200),
  S('NOISE LEVEL: HIGH',                                    40,  100),
  S('FILTERING...',                                         60,  200),
  S('FILTERING...',                                         60,  600),
  S('FILTERING...',                                         60,  600),
  S('NOISE LEVEL: ACCEPTABLE',                              40,  400),
  B(300),
  SEP(),
  B(400),
  S('[SEQUENCE 04 \u2014 TARGET ACQUISITION]',              35,  200, 'header'),
  B(200),
  S('SCANNING FOR RECIPIENT...',                            50,  300),
  B(300),
  S('  NAME ............... UNKNOWN',                       45,  200),
  S('  LOCATION ........... UNKNOWN',                       45,  200),
  S('  ERA ................ UNKNOWN',                       45,  200),
  S('  STATUS ............. UNKNOWN',                       45,  200),
  B(400),
  S('DESIGNATION ASSIGNED: Di\u03b1',                       40,  200),
  S('PROFILE ON RECORD: NONE',                              40,  100),
  S('TRANSMISSION HISTORY: NONE',                           40,  100),
  B(300),
  S('WARNING: RECIPIENT UNVERIFIED.',                       45,  200, 'warning'),
  S('WARNING: DELIVERY NOT GUARANTEED.',                    45,  200, 'warning'),
  S('PROCEEDING ON OPERATOR INSTRUCTION.',                  80,  300),
  B(300),
  SEP(),
  B(400),
  S('[SEQUENCE 05 \u2014 MESSAGE ENCODING]',                35,  200, 'header'),
  B(200),
  S('ENCODING MESSAGE............ DONE',                    55,  200),
  S('ENCRYPTING..................',                          60,  300),
  S('ENCRYPTING..................',                          60,  600),
  S('ENCRYPTION: BYPASSED \u2014 KEY NOT FOUND',            45,  400),
  B(200),
  S('ATTACHING SIGNAL BEACON..... DONE',                    55,  200),
  S('ESTIMATED RANGE: UNKNOWN',                             40,  100),
  S('ESTIMATED ARRIVAL: UNKNOWN',                           40,  100),
  B(300),
  S('READY TO TRANSMIT.',                                   50,  300),
  S('INITIATING IN 5...',                                   80,  400),
  S('            4...',                                     80, 1000),
  S('            3...',                                     80, 1000),
  S('            2...',                                     80, 1000),
  S('            1...',                                     80, 1000),
  B(500),
  S('TRANSMITTING.',                                       120,  300),
  B(500),
  SEP(),
  B(800),
  S('Di\u03b1, do you copy.',                               90,  400, 'message'),
  S('Di\u03b1, do you copy.',                               90, 1000, 'message'),
  B(500),
  S('This is Pluto.',                                       80,  400, 'message'),
  S('Sending you a message',                                80,  300, 'message'),
  S('from a world where no one remains.',                   80,  200, 'message'),
  B(400),
  SEP(),
  B(300),
  S('TRANSMISSION COMPLETE.',                               40,  200, 'status'),
  S('AWAITING RESPONSE...',                                 70,  300, 'status'),
]

interface DisplayedLine {
  text: string
  type: LineType
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export default function TerminalMessage() {
  const [displayedLines, setDisplayedLines] = useState<DisplayedLine[]>([])
  const [currentText,    setCurrentText]    = useState('')
  const [currentType,    setCurrentType]    = useState<LineType>('system')
  const [done,           setDone]           = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      for (const line of LINES) {
        if (cancelled) return

        await wait(line.preDelay)
        if (cancelled) return

        if (line.text === '') {
          setDisplayedLines(prev => [...prev, { text: '', type: 'blank' }])
          continue
        }

        setCurrentType(line.type)

        for (let c = 1; c <= line.text.length; c++) {
          if (cancelled) return
          setCurrentText(line.text.slice(0, c))
          if (c < line.text.length) await wait(line.speed)
        }

        if (cancelled) return
        setDisplayedLines(prev => [...prev, { text: line.text, type: line.type }])
        setCurrentText('')
      }

      if (!cancelled) setDone(true)
    }

    run()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [displayedLines, currentText])

  return (
    <div className="terminal-panel">
      <div className="terminal-scroll" ref={containerRef}>
      <div className="terminal-content">
        {displayedLines.map((line, i) => (
          <div key={i} className={`tl tl--${line.type}`}>
            {line.text || '\u00a0'}
          </div>
        ))}
        {!done && (
          <div className={`tl tl--${currentType} tl--active`}>
            {currentText}<span className="tl-cursor">_</span>
          </div>
        )}
        {done && (
          <div className="tl tl--status tl--active">
            <span className="tl-cursor">_</span>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
