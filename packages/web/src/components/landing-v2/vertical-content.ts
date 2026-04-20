export interface VerticalContent {
  industry: string;
  slug: string;
  hero: { headline: string; subheadline: string; ctaText: string };
  painPoints: Array<{ title: string; description: string }>;
  features: Array<{ title: string; description: string; icon: string }>;
  competitors: Array<{ name: string; price: string; homer: string }>;
  pricingNote: string;
  compliance?: Array<{ title: string; description: string }>;
}

export const VERTICAL_CONTENT: Record<string, VerticalContent> = {
  cannabis: {
    industry: 'Cannabis',
    slug: 'cannabis',
    hero: {
      headline: 'Cannabis delivery software that keeps you compliant',
      subheadline:
        'ID verification, METRC integration, delivery manifests, and delivery zones\u2009\u2014\u2009built in. Not bolted on.',
      ctaText: 'Start free with cannabis delivery',
    },
    painPoints: [
      {
        title: 'METRC is a full-time job',
        description:
          'Manually reconciling METRC manifests with delivery logs eats hours every week\u2009\u2014\u2009and one mistake triggers an audit.',
      },
      {
        title: 'Per-driver pricing kills 4/20',
        description:
          'Your busiest day of the year shouldn\u2019t be your most expensive. Scaling from 4 to 20 drivers for a day shouldn\u2019t cost $2,000.',
      },
      {
        title: 'General delivery tools have zero compliance',
        description:
          'Onfleet doesn\u2019t know what a delivery manifest is. Tookan can\u2019t flag a failed ID check. You\u2019re bolting compliance onto tools that weren\u2019t built for it.',
      },
      {
        title: 'Delivery limit tracking is manual',
        description:
          'State-mandated delivery limits per customer per day? You\u2019re tracking that in a spreadsheet. Until the state asks for records.',
      },
    ],
    features: [
      {
        title: 'ID Verification at the Door',
        description:
          'Driver app scans IDs and validates age before handoff. Failed checks are flagged and logged automatically.',
        icon: '\uD83C\uDD94',
      },
      {
        title: 'Delivery Manifests (PDF)',
        description:
          'Auto-generated manifests with product details, weights, and license numbers. Print or share digitally.',
        icon: '\uD83D\uDCCB',
      },
      {
        title: 'METRC & Dutchie Integration',
        description:
          'Two-way sync with METRC and Dutchie. Delivery events update your track-and-trace automatically.',
        icon: '\uD83D\uDD17',
      },
      {
        title: 'Delivery Zones',
        description:
          'Radius-based and zip code zones. Enforce delivery boundaries by license type and jurisdiction.',
        icon: '\uD83D\uDDFA\uFE0F',
      },
      {
        title: 'Driver Kits (Inventory Tracking)',
        description:
          'Track what\u2019s in each driver\u2019s vehicle in real time. Know exactly which products left the dispensary and which came back.',
        icon: '\uD83D\uDCE6',
      },
      {
        title: 'Cash-on-Delivery',
        description:
          'Collect cash at the door with driver-side reconciliation. End-of-shift cash counts built into the driver app.',
        icon: '\uD83D\uDCB5',
      },
    ],
    competitors: [
      { name: 'Onfleet', price: '$550/mo, no compliance features', homer: 'METRC, manifests, ID verification built in' },
      { name: 'Tookan', price: '$129/mo, no cannabis features', homer: 'Delivery zones, inventory kits, cash handling' },
      { name: 'WebJoint', price: 'California only', homer: 'Multi-state. Built for where cannabis is going.' },
    ],
    pricingNote: 'Unlimited drivers. Per-order pricing. No surprise fees on 4/20.',
    compliance: [
      {
        title: 'METRC Compliant',
        description: 'Automated track-and-trace sync keeps your delivery records audit-ready across all supported states.',
      },
      {
        title: 'Age Verification',
        description: 'ID scanning at every handoff with failed-check logging and configurable age thresholds.',
      },
      {
        title: 'Delivery Manifests',
        description: 'State-compliant manifests generated automatically for every route with full product detail.',
      },
      {
        title: 'Delivery Limit Enforcement',
        description: 'Per-customer, per-day limits enforced at dispatch time. No more manual spreadsheet tracking.',
      },
    ],
  },

  florist: {
    industry: 'Florist',
    slug: 'florist',
    hero: {
      headline: 'Flower delivery that delights the sender and the recipient',
      subheadline:
        'Gift messages, delivery photos to the sender, and per-order pricing that won\u2019t bankrupt you on Valentine\u2019s Day.',
      ctaText: 'Start free with flower delivery',
    },
    painPoints: [
      {
        title: 'The sender never sees what arrived',
        description:
          'They spent $85 on an arrangement and have no idea if it looked good, arrived on time, or made it to the right door. Anxiety, not delight.',
      },
      {
        title: 'Per-driver pricing kills Valentine\u2019s Day',
        description:
          'You need 10 drivers for one week. At $40/driver/month, that\u2019s $400 for 5 days of work. Per-order pricing makes seasonal scaling painless.',
      },
      {
        title: 'Temp drivers are a nightmare to onboard',
        description:
          'Your Valentine\u2019s Day drivers need to be delivering, not watching training videos. They need a link, a route, and a go button.',
      },
      {
        title: 'Wire orders are still manual',
        description:
          'FTD and Teleflora orders come in by fax or portal. You\u2019re re-keying them into a separate system. Every. Single. One.',
      },
    ],
    features: [
      {
        title: 'Gift Messages & Sender Notifications',
        description:
          'Attach gift messages to deliveries. Senders get a notification with photo proof when their flowers arrive.',
        icon: '\uD83D\uDC8C',
      },
      {
        title: 'Delivery Photo to Sender',
        description:
          'Driver snaps a photo at the door. The sender gets it instantly. Delight, not doubt.',
        icon: '\uD83D\uDCF8',
      },
      {
        title: 'Temp Driver Quick-Invite',
        description:
          'Send a link. They tap it. They\u2019re driving. No accounts, no training portals, no friction.',
        icon: '\u26A1',
      },
      {
        title: 'FTD & Teleflora Integration',
        description:
          'Wire service orders imported automatically. No more re-keying from fax sheets.',
        icon: '\uD83C\uDF3A',
      },
      {
        title: 'Time-Window Delivery',
        description:
          'Customers choose 2-hour delivery windows. Routes are built to hit every window without backtracking.',
        icon: '\u23F0',
      },
      {
        title: 'Dense-Stop Route Planning',
        description:
          'Real road-network routing, not crow-flies. Handle 80 deliveries in a day without burning gas or time.',
        icon: '\uD83D\uDDFA\uFE0F',
      },
    ],
    competitors: [
      { name: 'Routific', price: '$40/driver/mo \u2014 10 V-Day drivers = $400/mo', homer: 'Unlimited drivers. Pay per delivery.' },
      { name: 'FloristWare', price: 'No routing at all', homer: 'Full route optimization + delivery management' },
      { name: 'Track-POD', price: '$29/driver/mo', homer: 'Per-order pricing + gift message + sender photos' },
    ],
    pricingNote: '10 drivers on Valentine\u2019s Day? Pay per delivery, not per driver.',
  },

  pharmacy: {
    industry: 'Pharmacy',
    slug: 'pharmacy',
    hero: {
      headline: 'HIPAA-compliant prescription delivery for independent pharmacies',
      subheadline:
        'Controlled substance tracking, cold chain monitoring, patient verification\u2009\u2014\u2009all HIPAA-ready with a 10-year audit trail.',
      ctaText: 'Start free with pharmacy delivery',
    },
    painPoints: [
      {
        title: 'HIPAA compliance is scary',
        description:
          'One data breach and you\u2019re facing $50K+ in fines. General delivery tools show patient names and addresses to drivers with zero access controls.',
      },
      {
        title: 'Controlled substances need chain-of-custody',
        description:
          'Schedule II prescriptions can\u2019t be left at a doorstep. You need scan-in, scan-out, patient verification, and a tamper-evident audit trail.',
      },
      {
        title: 'Cold chain meds arrive warm',
        description:
          'Insulin, biologics, and compounded meds need temperature-controlled delivery. Your current system doesn\u2019t even know what\u2019s temperature-sensitive.',
      },
      {
        title: 'Copay collection at the door',
        description:
          'Patients owe $12.50. Your driver doesn\u2019t have change. The delivery fails. Now you\u2019re re-routing tomorrow for $12.50.',
      },
    ],
    features: [
      {
        title: 'HIPAA-Safe Driver Display',
        description:
          'Drivers see delivery address and instructions\u2009\u2014\u2009never patient names, prescriptions, or medical details.',
        icon: '\uD83D\uDD12',
      },
      {
        title: 'Controlled Substance Flags',
        description:
          'Schedule II\u2013V flags on orders. Patient ID verification required before handoff. Full chain-of-custody logging.',
        icon: '\u26A0\uFE0F',
      },
      {
        title: 'Cold Chain Confirmation',
        description:
          'Flag temperature-sensitive orders. Drivers confirm cold-pack status at pickup and delivery. Alerts for extended transit.',
        icon: '\u2744\uFE0F',
      },
      {
        title: 'Patient DOB Verification',
        description:
          'Drivers verify patient date of birth before handoff. Failed verifications are logged and escalated automatically.',
        icon: '\uD83C\uDD94',
      },
      {
        title: 'PioneerRx Integration',
        description:
          'Sync prescriptions and delivery schedules directly from PioneerRx. No more double-entry between pharmacy and delivery.',
        icon: '\uD83D\uDD17',
      },
      {
        title: 'Copay Collection',
        description:
          'Collect copays at the door via card reader or digital payment. Reconcile automatically at end of shift.',
        icon: '\uD83D\uDCB3',
      },
    ],
    competitors: [
      { name: 'RxMile', price: 'Custom pricing, opaque contracts', homer: 'Transparent per-order pricing. No lock-in.' },
      { name: 'Route4Me', price: '$199+/mo, not pharmacy-specific', homer: 'HIPAA compliance, cold chain, patient verification' },
      { name: 'Generic delivery tools', price: 'No HIPAA. No compliance.', homer: '10-year audit trail, HIPAA-ready' },
    ],
    pricingNote: 'Built for the 23,000+ independent pharmacies that deserve better than spreadsheets.',
    compliance: [
      {
        title: 'HIPAA Ready',
        description: 'PHI is never exposed to drivers. Audit logs retained for 10 years. BAA available on request.',
      },
      {
        title: 'Controlled Substance Tracking',
        description: 'Schedule II\u2013V chain-of-custody with scan-in/scan-out, patient verification, and tamper logging.',
      },
      {
        title: 'Cold Chain Monitoring',
        description: 'Temperature-sensitive flag per order with pickup/delivery confirmation and transit time alerts.',
      },
      {
        title: '10-Year Audit Trail',
        description: 'Every delivery event, verification, and handoff logged permanently for regulatory review.',
      },
    ],
  },

  restaurant: {
    industry: 'Restaurant',
    slug: 'restaurant',
    hero: {
      headline: 'Own your delivery. Keep your customers.',
      subheadline:
        'Stop paying 30% to DoorDash. Speed-optimized routing, Square and Toast integration, and real-time tracking your customers will love.',
      ctaText: 'Start free with restaurant delivery',
    },
    painPoints: [
      {
        title: '30% marketplace commissions',
        description:
          'DoorDash and UberEats take 30% of every order. On a $40 meal, that\u2019s $12 gone\u2009\u2014\u2009more than your food cost. You\u2019re subsidizing their growth.',
      },
      {
        title: 'You don\u2019t own your customer data',
        description:
          'A customer orders from you 50 times on DoorDash. You don\u2019t have their email, their phone number, or their order history. They\u2019re DoorDash\u2019s customer.',
      },
      {
        title: 'Cold food from bad routing',
        description:
          'Marketplace drivers take 3 other pickups before delivering your food. It arrives cold. The 1-star review is on your restaurant, not theirs.',
      },
      {
        title: 'Fragmented order systems',
        description:
          'Orders come from your POS, your website, DoorDash, UberEats, and phone calls. You\u2019re running 4 tablets and a notepad.',
      },
    ],
    features: [
      {
        title: 'Speed-Priority Routing',
        description:
          'Routes optimized for delivery speed, not driver efficiency. Hot food arrives hot. Time from kitchen to door is the metric.',
        icon: '\uD83D\uDD25',
      },
      {
        title: 'Square & Toast POS Integration',
        description:
          'Orders flow from your POS to dispatch automatically. No re-keying, no tablets, no missed orders.',
        icon: '\uD83D\uDD17',
      },
      {
        title: 'Real-Time Customer Tracking',
        description:
          'Customers get a live map link. They see their driver, their ETA, and their food\u2019s journey. Fewer "where\u2019s my food" calls.',
        icon: '\uD83D\uDCCD',
      },
      {
        title: 'Delivery Photo Proof',
        description:
          'Photo at the door. GPS stamp. Timestamp. When a customer says "it never arrived," you have evidence.',
        icon: '\uD83D\uDCF8',
      },
      {
        title: 'Customer Notifications',
        description:
          'Automated SMS at prep, pickup, in-transit, and delivered. Your brand, not DoorDash\u2019s.',
        icon: '\uD83D\uDCF1',
      },
      {
        title: 'Dinner-Rush Route Planning',
        description:
          'Real road-network routing with traffic awareness. Handle dinner rush with 3 drivers instead of 5.',
        icon: '\uD83D\uDDFA\uFE0F',
      },
    ],
    competitors: [
      { name: 'DoorDash / UberEats', price: '30% commission per order', homer: '$0 commissions. Keep 100% of revenue.' },
      { name: 'Onfleet', price: '$550/mo', homer: 'Free up to 100 orders/mo. Grows with you.' },
      { name: 'Shipday', price: 'Limited routing & tracking', homer: 'Full routing, tracking, POS integration' },
    ],
    pricingNote: '100 orders/month free. Keep 100% of your revenue.',
  },

  grocery: {
    industry: 'Grocery',
    slug: 'grocery',
    hero: {
      headline: 'Grocery delivery with cold chain built in',
      subheadline:
        'Frozen, refrigerated, and ambient items tracked separately. Substitutions handled. Customers notified in real time.',
      ctaText: 'Start free with grocery delivery',
    },
    painPoints: [
      {
        title: 'Temperature-sensitive items arrive warm',
        description:
          'Frozen items in the same bag as room-temp goods. No visibility into whether cold chain was maintained. Customer complaints spike in summer.',
      },
      {
        title: 'Substitution chaos',
        description:
          'Out of organic whole milk? Your picker texts the customer. Customer doesn\u2019t reply. Now you\u2019re delivering 2% milk and praying.',
      },
      {
        title: 'Customers don\u2019t know when delivery is coming',
        description:
          '"Your delivery is between 10am and 4pm." That\u2019s not a delivery window\u2009\u2014\u2009that\u2019s a hostage situation.',
      },
      {
        title: 'Narrow delivery windows are impossible to hit',
        description:
          'Customers want 1-hour windows. Your routing tool doesn\u2019t factor in dwell time, elevator waits, or building access.',
      },
    ],
    features: [
      {
        title: 'Temperature Zone Tracking',
        description:
          'Frozen, refrigerated, and ambient zones tracked per order. Drivers confirm zone integrity at pickup and delivery.',
        icon: '\uD83C\uDF21\uFE0F',
      },
      {
        title: 'Substitution Management',
        description:
          'Customer-approved substitutions managed in-app. Picker proposes, customer approves or rejects, driver delivers the right items.',
        icon: '\uD83D\uDD04',
      },
      {
        title: 'Cold Chain Alerts',
        description:
          'Transit time exceeds threshold for frozen items? Dispatcher gets an alert. Re-route or escalate before the customer gets warm ice cream.',
        icon: '\u2744\uFE0F',
      },
      {
        title: 'Real-Time Tracking',
        description:
          'Customers see their driver on a live map with a real ETA. Not "sometime today." 15 minutes from now.',
        icon: '\uD83D\uDCCD',
      },
      {
        title: 'Tight-Window Route Planning',
        description:
          'Routes built for tight delivery windows with realistic service times. Elevator? Walk-up? HOMER factors it in.',
        icon: '\uD83D\uDDFA\uFE0F',
      },
      {
        title: 'Customer Notifications',
        description:
          'Automated updates at every stage: picking, packed, out for delivery, arriving, delivered. Fewer support calls.',
        icon: '\uD83D\uDCF1',
      },
    ],
    competitors: [
      { name: 'Instacart', price: 'Takes your customers and your margin', homer: 'Your customers, your data, your brand' },
      { name: 'Onfleet', price: '$550/mo, no temperature zones', homer: 'Cold chain tracking + per-order pricing' },
      { name: 'Generic tools', price: 'No grocery features', homer: 'Temp zones, substitutions, tight delivery windows' },
    ],
    pricingNote: 'From corner store to regional grocer. Per-order pricing that grows with you.',
  },

  furniture: {
    industry: 'Furniture',
    slug: 'furniture',
    hero: {
      headline: 'White-glove delivery management for furniture retailers',
      subheadline:
        '2-person crews, assembly scheduling, haul-away tracking, and 4-hour delivery windows\u2009\u2014\u2009all in one platform.',
      ctaText: 'Start free with furniture delivery',
    },
    painPoints: [
      {
        title: 'Coordinating 2-person crews is manual',
        description:
          'You\u2019re texting drivers at 6am to pair them up. Skill matching, vehicle capacity, and crew preferences\u2009\u2014\u2009all in your head.',
      },
      {
        title: 'Assembly time blows up routes',
        description:
          'A 30-minute assembly adds an hour when you count setup and cleanup. Your routing tool doesn\u2019t know that. Your schedule does.',
      },
      {
        title: 'Haul-away logistics',
        description:
          'Customer wants the old mattress removed. Is it going to the dump? Recycling? Does the truck have room? Nobody\u2019s tracking this.',
      },
      {
        title: 'Wide scheduling windows needed',
        description:
          'Furniture delivery needs 4-hour windows. Most delivery tools max out at 2 hours and don\u2019t handle the complexity.',
      },
    ],
    features: [
      {
        title: 'Crew Assignment',
        description:
          '2-person and 4-person crew management. Pair drivers by skill, vehicle type, and availability. No more 6am group texts.',
        icon: '\uD83D\uDC65',
      },
      {
        title: 'Assembly Tracking',
        description:
          'Flag deliveries that include assembly. Track assembly start/end times. Bill accurately for assembly services.',
        icon: '\uD83D\uDD27',
      },
      {
        title: 'Haul-Away Flags',
        description:
          'Mark deliveries that include haul-away. Track disposal type (dump, recycling, donation). Ensure truck has capacity.',
        icon: '\uD83D\uDE9A',
      },
      {
        title: 'Wide Time Windows',
        description:
          '4-hour delivery windows that customers actually find acceptable. Routes built around realistic furniture delivery times.',
        icon: '\u23F0',
      },
      {
        title: 'Delivery Photo Proof',
        description:
          'Before and after photos. Proof the item was delivered undamaged. Proof the old item was hauled away.',
        icon: '\uD83D\uDCF8',
      },
      {
        title: 'Real-Time Customer Tracking',
        description:
          'Customers see their delivery crew on a live map. "Your delivery is 2 stops away" beats "sometime between 10 and 2."',
        icon: '\uD83D\uDCCD',
      },
    ],
    competitors: [
      { name: 'Locate2u', price: '$15/seat \u2014 tracking only, no crew mgmt', homer: 'Crew assignment, assembly, haul-away' },
      { name: 'InstaDispatch', price: 'Generic last-mile, no furniture features', homer: 'Built for heavy, multi-person deliveries' },
      { name: 'Manual spreadsheets', price: 'Free but fragile', homer: 'Replace the spreadsheet. Keep the control.' },
    ],
    pricingNote: 'Every delivery is a brand experience. Make it count.',
  },
};
