export function BayAreaMap() {
  return (
    <svg
      viewBox="0 0 1000 1100"
      preserveAspectRatio="xMidYMid slice"
      className="bay-map"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="driverGlow">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="bridgeGlow">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="bayGrad" cx="45%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#0A1628" />
          <stop offset="100%" stopColor="#060E1A" />
        </radialGradient>
        <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#182540" strokeWidth="0.4" />
        </pattern>
      </defs>

      {/* Land base */}
      <rect width="1000" height="1100" fill="#0B1220" />
      <rect width="1000" height="1100" fill="url(#mapGrid)" opacity="0.5" />

      {/* Pacific Ocean — west coast */}
      <path
        d="M0 0 L0 1100 L65 1100 C78 1040,88 970,95 900 C102 830,108 760,118 695
           C128 635,135 575,142 520 C148 465,152 412,158 360 C165 305,175 255,188 215
           C200 180,212 155,225 135 C235 118,242 102,248 88 L210 40 L0 0 Z"
        fill="#060E1A"
      />

      {/* San Francisco Bay */}
      <path
        d="M238 178 C255 160,295 135,345 122 C395 110,445 105,492 110
           C515 115,520 135,518 160 C516 185,514 212,515 238
           C516 258,522 278,528 300 C536 330,542 365,548 405
           C553 445,557 488,560 530 C562 568,566 608,572 650
           C576 690,578 728,575 765 C568 808,545 845,515 875
           C490 900,458 912,428 912 C400 908,378 892,358 868
           C338 838,318 800,305 762 C295 728,290 695,290 665
           C290 635,295 608,300 580 C305 552,305 522,300 492
           C295 462,288 432,283 402 C278 372,275 342,278 312
           C282 288,292 270,300 258 C305 248,302 232,295 220
           C285 205,270 192,255 182 Z"
        fill="url(#bayGrad)"
      />

      {/* Bay coastline highlight */}
      <path
        d="M238 178 C255 160,295 135,345 122 C395 110,445 105,492 110
           C515 115,520 135,518 160 C516 185,514 212,515 238
           C516 258,522 278,528 300 C536 330,542 365,548 405
           C553 445,557 488,560 530 C562 568,566 608,572 650
           C576 690,578 728,575 765 C568 808,545 845,515 875
           C490 900,458 912,428 912 C400 908,378 892,358 868
           C338 838,318 800,305 762 C295 728,290 695,290 665
           C290 635,295 608,300 580 C305 552,305 522,300 492
           C295 462,288 432,283 402 C278 372,275 342,278 312
           C282 288,292 270,300 258 C305 248,302 232,295 220
           C285 205,270 192,255 182"
        fill="none"
        stroke="#94A3B8"
        strokeWidth="0.5"
        opacity="0.06"
      />

      {/* Range rings */}
      <circle cx="410" cy="490" r="130" fill="none" stroke="#F59E0B" strokeWidth="0.5" opacity="0.05" />
      <circle cx="410" cy="490" r="260" fill="none" stroke="#F59E0B" strokeWidth="0.5" opacity="0.035" />
      <circle cx="410" cy="490" r="390" fill="none" stroke="#F59E0B" strokeWidth="0.5" opacity="0.025" />

      {/* Highways */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* US-101 */}
        <path
          d="M248 82 C250 115,252 148,254 172 C258 198,262 222,260 255
             C258 288,256 318,254 352 C252 395,254 440,258 485
             C262 525,268 562,276 602 C286 648,298 692,315 735
             C335 785,362 830,398 868 C432 895,465 910,495 902
             C528 892,558 865,582 832"
          stroke="#1E3055" strokeWidth="2.5"
        />
        {/* I-80 */}
        <path
          d="M298 262 C342 256,405 248,462 238 C502 232,528 218,542 198
             C558 175,575 148,598 118 C618 92,642 68,670 48"
          stroke="#1E3055" strokeWidth="2.5"
        />
        {/* I-880 */}
        <path
          d="M528 298 C535 338,542 378,546 418 C550 460,555 502,558 545
             C562 588,568 632,572 675 C575 718,568 755,550 790
             C532 822,510 852,480 878 C458 898,442 908,428 912"
          stroke="#1E3055" strokeWidth="2.5"
        />
        {/* I-280 */}
        <path
          d="M248 285 C240 325,234 365,230 405 C226 445,224 485,224 525
             C224 565,230 605,242 645 C254 685,270 725,294 765
             C320 805,354 842,398 875"
          stroke="#1E3055" strokeWidth="2"
        />
        {/* I-580 */}
        <path
          d="M530 292 C568 305,615 318,665 322 C718 325,768 318,822 305"
          stroke="#1E3055" strokeWidth="2"
        />
        {/* CA-92 San Mateo Bridge */}
        <path d="M305 548 L560 535" stroke="#1E3055" strokeWidth="1.5" strokeDasharray="6 4" />
        {/* Dumbarton Bridge */}
        <path d="M292 658 L572 648" stroke="#1E3055" strokeWidth="1.5" strokeDasharray="6 4" />
      </g>

      {/* Bridges — accent highlight */}
      <g stroke="#F59E0B" strokeWidth="3" opacity="0.45" strokeLinecap="round" filter="url(#bridgeGlow)">
        <line x1="232" y1="188" x2="245" y2="155" /> {/* Golden Gate */}
        <line x1="305" y1="260" x2="515" y2="240" /> {/* Bay Bridge */}
      </g>

      {/* City labels */}
      <g fontFamily="'Satoshi',sans-serif">
        <circle cx="268" cy="258" r="3.5" fill="#94A3B8" opacity="0.6" />
        <text x="245" y="278" textAnchor="middle" fontSize="12" fontWeight="600" fill="#94A3B8" opacity="0.7">
          San Francisco
        </text>

        <circle cx="530" cy="282" r="3" fill="#94A3B8" opacity="0.5" />
        <text x="558" y="286" fontSize="11" fontWeight="500" fill="#94A3B8" opacity="0.6">Oakland</text>

        <circle cx="520" cy="195" r="2.5" fill="#94A3B8" opacity="0.4" />
        <text x="542" y="198" fontSize="10" fill="#94A3B8" opacity="0.5">Berkeley</text>

        <rect x="274" y="438" width="30" height="14" rx="2" fill="none" stroke="#475569" strokeWidth="0.8" opacity="0.4" />
        <text x="289" y="449" textAnchor="middle" fontSize="8" fontFamily="'JetBrains Mono',monospace" fill="#475569" opacity="0.5">SFO</text>

        <circle cx="448" cy="905" r="3" fill="#94A3B8" opacity="0.4" />
        <text x="448" y="928" textAnchor="middle" fontSize="11" fontWeight="500" fill="#94A3B8" opacity="0.5">San Jose</text>

        <circle cx="290" cy="680" r="2" fill="#94A3B8" opacity="0.3" />
        <text x="268" y="695" fontSize="10" fill="#94A3B8" opacity="0.4">Palo Alto</text>

        <circle cx="576" cy="680" r="2" fill="#94A3B8" opacity="0.3" />
        <text x="596" y="685" fontSize="10" fill="#94A3B8" opacity="0.4">Fremont</text>

        <circle cx="502" cy="118" r="2" fill="#94A3B8" opacity="0.3" />
        <text x="522" y="122" fontSize="10" fill="#94A3B8" opacity="0.4">Richmond</text>

        <circle cx="235" cy="345" r="1.8" fill="#94A3B8" opacity="0.25" />
        <text x="210" y="360" fontSize="9" fill="#94A3B8" opacity="0.35">Daly City</text>
      </g>

      {/* Animated driver dots */}
      <g filter="url(#driverGlow)">
        {/* Driver 1: 101 southbound SF->Peninsula — trail */}
        <circle r="3" fill="#F59E0B" opacity="0.1">
          <animateMotion dur="24s" repeatCount="indefinite" begin="-0.7s"
            path="M260 255 C258 288,256 318,254 352 C252 395,254 440,258 485 C262 525,268 562,276 602 C286 648,298 692,315 735" />
        </circle>
        <circle r="3.5" fill="#F59E0B" opacity="0.3">
          <animateMotion dur="24s" repeatCount="indefinite" begin="-0.35s"
            path="M260 255 C258 288,256 318,254 352 C252 395,254 440,258 485 C262 525,268 562,276 602 C286 648,298 692,315 735" />
        </circle>
        <circle r="4.5" fill="#F59E0B" opacity="0.9">
          <animateMotion dur="24s" repeatCount="indefinite" begin="0s"
            path="M260 255 C258 288,256 318,254 352 C252 395,254 440,258 485 C262 525,268 562,276 602 C286 648,298 692,315 735" />
        </circle>

        {/* Driver 2: 880 south Oakland->Fremont — trail */}
        <circle r="3" fill="#F59E0B" opacity="0.1">
          <animateMotion dur="20s" repeatCount="indefinite" begin="-5.7s"
            path="M528 298 C535 338,542 378,546 418 C550 460,555 502,558 545 C562 588,568 632,572 675" />
        </circle>
        <circle r="3.5" fill="#F59E0B" opacity="0.3">
          <animateMotion dur="20s" repeatCount="indefinite" begin="-5.35s"
            path="M528 298 C535 338,542 378,546 418 C550 460,555 502,558 545 C562 588,568 632,572 675" />
        </circle>
        <circle r="4.5" fill="#F59E0B" opacity="0.9">
          <animateMotion dur="20s" repeatCount="indefinite" begin="-5s"
            path="M528 298 C535 338,542 378,546 418 C550 460,555 502,558 545 C562 588,568 632,572 675" />
        </circle>

        {/* Driver 3: Bay Bridge eastbound — green (delivered) */}
        <circle r="4" fill="#10B981" opacity="0.8">
          <animateMotion dur="14s" repeatCount="indefinite" begin="-2s"
            path="M298 262 C342 256,405 248,462 238 C502 232,528 218,542 198" />
        </circle>

        {/* Driver 4: 101 northbound Peninsula->SF */}
        <circle r="4" fill="#F59E0B" opacity="0.8">
          <animateMotion dur="26s" repeatCount="indefinite" begin="-10s"
            path="M315 735 C298 692,286 648,276 602 C268 562,262 525,258 485 C254 440,252 395,254 352 C256 318,258 288,260 255" />
        </circle>

        {/* Driver 5: 280 southbound */}
        <circle r="3.5" fill="#F59E0B" opacity="0.7">
          <animateMotion dur="22s" repeatCount="indefinite" begin="-14s"
            path="M248 285 C240 325,234 365,230 405 C226 445,224 485,224 525 C224 565,230 605,242 645" />
        </circle>

        {/* Driver 6: 580 eastbound — green */}
        <circle r="4" fill="#10B981" opacity="0.7">
          <animateMotion dur="12s" repeatCount="indefinite" begin="-6s"
            path="M530 292 C568 305,615 318,665 322 C718 325,768 318,822 305" />
        </circle>

        {/* Driver 7: Oakland local circuit */}
        <circle r="4.5" fill="#F59E0B" opacity="0.85">
          <animateMotion dur="10s" repeatCount="indefinite" begin="-3s"
            path="M528 280 C540 300,548 325,538 348 C528 365,515 352,520 332 C530 310,535 292,528 280" />
        </circle>

        {/* Driver 8: South Bay */}
        <circle r="4" fill="#F59E0B" opacity="0.75">
          <animateMotion dur="18s" repeatCount="indefinite" begin="-9s"
            path="M448 905 C492 898,528 875,558 845 C578 818,592 792,598 762" />
        </circle>

        {/* Driver 9: SF local — green */}
        <circle r="4" fill="#10B981" opacity="0.8">
          <animateMotion dur="9s" repeatCount="indefinite" begin="-1s"
            path="M255 235 C265 252,280 265,292 280 C278 298,262 288,255 272 C250 258,248 245,255 235" />
        </circle>

        {/* Driver 10: Marin heading south */}
        <circle r="4" fill="#F59E0B" opacity="0.85">
          <animateMotion dur="16s" repeatCount="indefinite" begin="-8s"
            path="M248 82 C250 115,252 148,254 172 C258 198,262 222,260 255" />
        </circle>
      </g>
    </svg>
  );
}
