// SEO landing pages: one per service people search for, each with original, practical content.
// Only services the business provides are listed; each links to the packages that deliver it.
// Prices are never written here: they come live from the packages ("price on request" until confirmed).
// Facts (distances, customs, rules) match the travel guides in content/blog. Keep them in step.

export type LandingSection = { heading: string; paragraphs?: string[]; bullets?: string[] };

export type LandingPage = {
  slug: string;
  /** Page heading (H1). */
  title: string;
  /** <title> before the " | Yatra Travels" suffix. Keep under about 45 characters. */
  metaTitle: string;
  /** 140–160 characters, unique to the page. */
  metaDescription: string;
  eyebrow: string;
  lead: string;
  /** Asset id from content/image-manifest.json, used for Open Graph and the page photo when available. */
  image: string;
  /** What schema.org Service calls this service. */
  serviceType: string;
  facts: { label: string; value: string }[];
  sections: LandingSection[];
  /** Packages that deliver this service, shown as cards with their live prices. The first is the "Book" target. */
  packageSlugs: string[];
  guideSlugs: string[];
  faqs: { q: string; a: string }[];
  whatsappText: string;
};

export const landingPages: LandingPage[] = [
  {
    slug: 'tirupati-travel-services',
    title: 'Tirupati travel services',
    metaTitle: 'Tirupati Travel Services: Tours, Taxis & Cabs',
    metaDescription: 'Tirupati travel services from one local team: Tirumala transport, temple tours, pilgrimage packages, day trips, airport pickups and cabs, with prices agreed first.',
    eyebrow: 'Tirupati · Tirumala · South India',
    lead: 'Everything a pilgrim or visitor needs to get around Tirupati, from the station pickup to the ghat road, the local temples and day trips further afield. One booking reference, one WhatsApp chat, and the price agreed before you travel.',
    image: 'tirupati-temple',
    serviceType: 'Travel agency services',
    facts: [
      { label: 'Based in', value: 'Tirupati, Andhra Pradesh' },
      { label: 'Vehicles', value: 'Sedan, SUV, Innova Crysta, Tempo Traveller' },
      { label: 'Group size', value: '1 to 12 travellers per vehicle' },
      { label: 'Payment', value: 'After we confirm, never online in advance' },
    ],
    sections: [
      {
        heading: 'What we do',
        paragraphs: [
          'Yatra Travels is a local travel operator in Tirupati. We provide vehicles with experienced drivers for pilgrims and visitors, and plan the day around what matters most to you: your darshan slot, your train or flight, and the pace that suits the elders in your group.',
          'We provide transport and planning. Darshan tickets for Tirumala are booked separately through TTD\'s official channels, and we schedule your pickup around the slot you have booked.',
        ],
      },
      {
        heading: 'Our services',
        bullets: [
          'Tirupati to Tirumala transport: one-way or return trips up the ghat road, with the driver waiting during darshan if you need.',
          'Tirupati local temple tours: Tiruchanur, Govindaraja Swamy, Kapileswara Swamy, Srinivasa Mangapuram and ISKCON in one day.',
          'Pilgrimage packages: arrival pickup, Tirumala transport and a temple day, planned as one trip.',
          'Day trips: Kanipakam and Srikalahasti together, or the Sripuram Golden Temple in Vellore.',
          'Airport and railway transfers: Tirupati Airport, Tirupati station and Renigunta Junction, including late arrivals.',
          'Cabs and outstation travel: hourly local cabs and one-way or round trips to Chennai, Bengaluru, Kanchipuram and beyond.',
        ],
      },
      {
        heading: 'How booking works',
        bullets: [
          'Send a request online or on WhatsApp. You get a booking reference straight away.',
          'We check vehicle availability for your date and confirm the price, pickup time and route with you by phone or WhatsApp.',
          'Your trip is confirmed only after you agree. Nothing is charged online.',
          'Before the trip you receive the driver\'s name, number and vehicle details.',
        ],
      },
      {
        heading: 'Choosing a vehicle',
        paragraphs: [
          'A sedan suits couples and small families with light luggage. An SUV seats up to six. The Toyota Innova Crysta seats seven in more comfort and is a favourite for long days and elderly travellers. For larger families and groups, a Tempo Traveller seats twelve with room for luggage. Not sure? Choose "Suggest for me" when you book and we will match the vehicle to your group.',
        ],
      },
    ],
    packageSlugs: ['tirupati-to-tirumala-transport', 'tirupati-local-temple-tour', 'tirupati-pilgrimage-package', 'kanipakam-srikalahasti-tour', 'vellore-golden-temple-tour', 'airport-railway-transfers'],
    guideSlugs: ['plan-tirumala-trip-from-tirupati', 'tirupati-temples-in-one-day'],
    faqs: [
      { q: 'Do you book darshan tickets?', a: 'No. We provide transport and planning only. Book darshan tickets through TTD\'s official channels and tell us your slot, and we will plan your pickup around it.' },
      { q: 'How do I pay?', a: 'We confirm the price with you before the trip, and you pay only after the booking is confirmed. There is no online payment when you send a request.' },
      { q: 'Can you pick us up from the station or airport?', a: 'Yes. We pick up from Tirupati Airport, Tirupati railway station and Renigunta Junction. Share your train or flight number and the driver will follow your actual arrival time.' },
      { q: 'Can you plan a trip of several days?', a: 'Yes. Tell us your dates, darshan slot and the places you want to visit, and we will suggest a day-by-day plan and a vehicle for your group.' },
    ],
    whatsappText: 'Hello, I would like to plan a trip in Tirupati.',
  },
  {
    slug: 'tirupati-to-tirumala-taxi',
    title: 'Tirupati to Tirumala taxi and transport',
    metaTitle: 'Tirupati to Tirumala Taxi & Cab Service',
    metaDescription: 'Book a taxi from Tirupati to Tirumala: hotel, station and airport pickups, the Alipiri check, one-way or return with the driver waiting during your darshan.',
    eyebrow: 'Ghat road transport',
    lead: 'A comfortable, private ride from anywhere in Tirupati up to Tirumala and back, timed around your darshan slot. One-way or return, for one traveller or a group of twelve.',
    image: 'tirumala-trip',
    serviceType: 'Taxi service',
    facts: [
      { label: 'Journey time', value: 'About an hour up the ghat road, plus the Alipiri check' },
      { label: 'Pickup', value: 'Hotels, Tirupati station, Renigunta, the airport, the bus stand' },
      { label: 'Trip types', value: 'One-way, or return with waiting time' },
      { label: 'Vehicles', value: 'Sedan, SUV, Innova Crysta, Tempo Traveller' },
    ],
    sections: [
      {
        heading: 'How the journey works',
        paragraphs: [
          'Your driver collects you from your hotel, the railway station, the bus stand or the airport and drives to Alipiri at the foot of the hills. Every vehicle and its passengers go through TTD\'s security check here before the drive up the ghat road to Tirumala.',
          'The climb itself usually takes about an hour. On weekends, holidays and festival days, the checkpoint and the ghat road are busier, so we build in extra time. At the top, we drop you at your accommodation or near the darshan queue complex.',
        ],
      },
      {
        heading: 'One-way or return',
        bullets: [
          'One-way: we take you up, or bring you down, at the time you choose.',
          'Return with waiting: the driver waits at Tirumala during your darshan, or comes back at an agreed time. Tell us your slot so we can plan the waiting time.',
          'Return on another day: if you are staying at Tirumala overnight, we collect you for the journey down when you are ready.',
        ],
      },
      {
        heading: 'Before you go up the hill',
        bullets: [
          'Darshan tickets are booked separately through TTD. We provide the transport and plan around your slot.',
          'Items such as alcohol, tobacco and non-vegetarian food are not allowed on the hill. Vehicles and bags are checked at Alipiri.',
          'Traditional dress is expected, and phones and cameras are not allowed inside the temple.',
          'Ghat road rules and timings can change. Check TTD\'s current guidance at ttdevasthanams.ap.gov.in before planning a very late or very early journey.',
        ],
      },
      {
        heading: 'Arriving by train or flight?',
        paragraphs: [
          'Many pilgrims go straight from the station or airport to Tirumala. From Tirupati railway station the journey is usually around an hour. From Renigunta Junction or Tirupati Airport, allow roughly an hour and a quarter to an hour and a half. Share your train or flight number and the driver will follow your actual arrival.',
        ],
      },
    ],
    packageSlugs: ['tirupati-to-tirumala-transport', 'airport-railway-transfers', 'tirupati-pilgrimage-package'],
    guideSlugs: ['plan-tirumala-trip-from-tirupati', 'tirupati-airport-railway-station-to-tirumala'],
    faqs: [
      { q: 'How long does it take to drive from Tirupati to Tirumala?', a: 'Usually about an hour on the ghat road, plus time for the Alipiri security check. Allow longer on weekends and festival days.' },
      { q: 'Can the driver wait while we have darshan?', a: 'Yes, on a return booking. Waiting time depends on your darshan slot, so tell us your slot when you book.' },
      { q: 'Do you arrange darshan tickets?', a: 'No. We provide transport only. Book darshan tickets through TTD\'s official channels.' },
      { q: 'Can you collect us from the footpath?', a: 'Yes. If you are walking up the Alipiri or Srivari Mettu footpath, we can drop you at the start, carry your luggage and meet you at the top.' },
    ],
    whatsappText: 'Hello, I need a taxi from Tirupati to Tirumala.',
  },
  {
    slug: 'tirupati-pilgrimage-packages',
    title: 'Tirupati pilgrimage packages',
    metaTitle: 'Tirupati Pilgrimage Packages with Transport',
    metaDescription: 'Tirupati pilgrimage packages with pickup, Tirumala transport for your darshan slot and a day at the Tirupati temples. Two-day plans or a custom trip for your family.',
    eyebrow: 'Planned pilgrimages',
    lead: 'For families travelling from other cities: we meet you on arrival, take you up to Tirumala for the darshan slot you have booked, show you the temples of Tirupati and drop you for your journey home.',
    image: 'tirumala-hills',
    serviceType: 'Pilgrimage tour',
    facts: [
      { label: 'Typical length', value: '2 days, 1 night, or longer on request' },
      { label: 'Includes', value: 'Vehicle with driver, pickup and drop, fuel and driver allowance' },
      { label: 'Not included', value: 'Darshan tickets, accommodation, meals' },
      { label: 'Group size', value: '1 to 12 travellers' },
    ],
    sections: [
      {
        heading: 'A two-day pilgrimage',
        paragraphs: [
          'Day one starts with a pickup at Tirupati or Renigunta station, or Tirupati Airport, and a drop at your accommodation. When it is time for your booked darshan slot, we drive you through the Alipiri checkpoint and up to Tirumala.',
          'Day two is for the temples in the town below: Sri Padmavathi Ammavari Temple at Tiruchanur, Sri Govindaraja Swamy Temple and Sri Kapileswara Swamy Temple, before we drop you at the station or airport.',
        ],
      },
      {
        heading: 'Three days or more',
        paragraphs: [
          'With an extra day, many families add Kanipakam and Srikalahasti, two of the region\'s most important temples, as a full-day trip. Others add the Sripuram Golden Temple in Vellore. We plan each day so nobody is rushed and the longest drives fall on the days without darshan.',
        ],
        bullets: [
          'Day 1: arrival and Tirumala darshan at your booked slot.',
          'Day 2: Tirupati and Tiruchanur temples at a relaxed pace.',
          'Day 3: Srikalahasti and Kanipakam, back in Tirupati by evening.',
        ],
      },
      {
        heading: 'Planned around your darshan',
        paragraphs: [
          'Your darshan slot fixes the shape of the whole trip, so we start from it. If your slot changes, tell us as soon as possible and we will adjust the schedule wherever we can. Accommodation is not included by default, but we can suggest options if you need help finding a hotel.',
        ],
      },
      {
        heading: 'Travelling with elders or children',
        bullets: [
          'Choose an Innova Crysta or Tempo Traveller for extra space and comfort on long days.',
          'We build rest stops into the plan and avoid early starts on consecutive days where possible.',
          'Tell us about wheelchairs, medical needs or dietary requirements when you book.',
        ],
      },
    ],
    packageSlugs: ['tirupati-pilgrimage-package', 'custom-pilgrimage-itinerary', 'kanipakam-srikalahasti-tour'],
    guideSlugs: ['plan-tirumala-trip-from-tirupati', 'tirupati-temples-in-one-day'],
    faqs: [
      { q: 'Is accommodation included?', a: 'Not by default. Tell us if you need help finding a hotel and we will suggest options.' },
      { q: 'What if our darshan slot changes?', a: 'Let us know as soon as possible and we will adjust the schedule wherever we can.' },
      { q: 'Can we add Kanipakam, Srikalahasti or Vellore?', a: 'Yes. Each works well as a separate day. Mention it in your booking request and we will plan the order.' },
      { q: 'Do you book darshan tickets?', a: 'No. Darshan tickets are booked separately through TTD\'s official channels. We plan transport around your slot.' },
    ],
    whatsappText: 'Hello, I would like a Tirupati pilgrimage package.',
  },
  {
    slug: 'tirupati-local-temple-tours',
    title: 'Tirupati local temple tours',
    metaTitle: 'Tirupati Local Temple Tour by Car',
    metaDescription: 'A full-day Tirupati local temple tour by private car: Tiruchanur Padmavathi, Govindaraja Swamy, Kapileswara Swamy, Srinivasa Mangapuram and ISKCON.',
    eyebrow: 'Full-day temple tour',
    lead: 'Many pilgrims visit Tirumala and leave without seeing the temples in the town below. Several are closely linked to the story of Lord Venkateswara, and all of them fit comfortably into one day with your own car and driver.',
    image: 'local-darshan',
    serviceType: 'Temple tour',
    facts: [
      { label: 'Duration', value: 'Full day, about 8–9 hours' },
      { label: 'Start', value: 'Usually 6–7 AM, confirmed the evening before' },
      { label: 'Temples', value: 'Five, in an order that avoids backtracking' },
      { label: 'Vehicles', value: 'Sedan, SUV, Innova Crysta, Tempo Traveller' },
    ],
    sections: [
      {
        heading: 'The temples on the tour',
        bullets: [
          'Sri Padmavathi Ammavari Temple, Tiruchanur: about 5 km from the centre, dedicated to Goddess Padmavathi, consort of Lord Venkateswara. Many believe a Tirumala pilgrimage is incomplete without visiting her.',
          'Sri Govindaraja Swamy Temple: one of the oldest and largest temples in Tirupati, near the railway station, with Lord Govindaraja in a reclining posture.',
          'Sri Kapileswara Swamy Temple: a Shiva temple at the foot of the hills, known for the Kapila Theertham pool and waterfall, which is at its best after good rains.',
          'ISKCON Tirupati: the calm, spacious Sri Sri Radha Govinda temple on the road towards Alipiri, a good stop for a break.',
          'Sri Kalyana Venkateswara Swamy Temple, Srinivasa Mangapuram: about 12 km west, where Lord Venkateswara is said to have stayed after his marriage. Popular with newly married couples.',
        ],
      },
      {
        heading: 'A suggested order',
        paragraphs: [
          'We usually start at Tiruchanur before the crowds build, head back into town for Govindaraja Swamy, move north to Kapileswara Swamy at the foot of the hills, stop at ISKCON, and finish at Srinivasa Mangapuram. Your driver adjusts the order to traffic, temple timings and where you are staying, and you can add or swap stops.',
        ],
      },
      {
        heading: 'Tips for the day',
        bullets: [
          'Check temple timings before you go, as they change on festival days. Several of these temples are administered by TTD.',
          'Wear traditional, modest clothing, and slip-on footwear: you will take your shoes off many times.',
          'Photography is generally not allowed inside the sanctum, and some temples ask you to deposit phones.',
          'Carry water and small change, and plan a meal break around midday.',
          'Tiruchanur is busier on Fridays and during festivals, so allow extra time there.',
        ],
      },
      {
        heading: 'Combine it with Tirumala',
        paragraphs: [
          'Most pilgrims take this tour on the day before or after their Tirumala darshan. Fitting Tirumala and all five temples into one day is rarely comfortable, so we recommend two separate days.',
        ],
      },
    ],
    packageSlugs: ['tirupati-local-temple-tour', 'local-cab-booking', 'tirupati-pilgrimage-package'],
    guideSlugs: ['tirupati-temples-in-one-day'],
    faqs: [
      { q: 'What time does the tour start?', a: 'Usually between 6 and 7 AM. Your driver confirms the time the evening before.' },
      { q: 'Can we change the order of temples or add a stop?', a: 'Yes. Mention it in your booking request or tell the driver on the day. Extra time or distance may be charged.' },
      { q: 'Can we do the tour in half a day?', a: 'You can visit two or three of the temples in about four hours. Our local cab booking by the hour is the easiest way to do this.' },
      { q: 'Is the tour suitable for elderly travellers?', a: 'Yes. Some temples involve walking and standing, so we build in rest stops. An Innova Crysta is the most comfortable choice for long days.' },
    ],
    whatsappText: 'Hello, I would like to book a Tirupati local temple tour.',
  },
  {
    slug: 'tirupati-to-kanipakam-srikalahasti',
    title: 'Tirupati to Kanipakam and Srikalahasti',
    metaTitle: 'Tirupati to Kanipakam & Srikalahasti Cab',
    metaDescription: 'Day trip by car from Tirupati to Kanipakam Varasiddhi Vinayaka and Srikalahasti temples: distances, the best route, Rahu-Ketu pooja tips and hotel pickup.',
    eyebrow: 'Full-day temple trip',
    lead: 'Two of the most important temples near Tirupati, Sri Varasiddhi Vinayaka at Kanipakam and Sri Kalahasteeswara at Srikalahasti, in one comfortable day with your own car and driver.',
    image: 'kanipakam-temple',
    serviceType: 'Day tour',
    facts: [
      { label: 'Kanipakam', value: 'About 70 km, 1.5 to 2 hours from Tirupati' },
      { label: 'Srikalahasti', value: 'About 36 km, roughly 1 hour from Tirupati' },
      { label: 'Duration', value: 'Full day, back in Tirupati by evening' },
      { label: 'Pickup', value: 'From your hotel in Tirupati' },
    ],
    sections: [
      {
        heading: 'Kanipakam: Sri Varasiddhi Vinayaka Swamy',
        paragraphs: [
          'The Kanipakam temple is dedicated to Lord Ganesha, worshipped as Sri Varasiddhi Vinayaka. The idol is believed to be self-manifested and, by local belief, slowly growing. The temple is built around a sacred well, and many families visit before starting something new.',
        ],
      },
      {
        heading: 'Srikalahasti: Sri Kalahasteeswara Swamy',
        paragraphs: [
          'Srikalahasti is one of the most important Shiva temples in South India. The lingam is worshipped as the Vayu lingam, representing air, one of the Pancha Bhoota Sthalams. The temple stands on the banks of the Swarnamukhi river and is especially known for Rahu-Ketu pooja.',
        ],
      },
      {
        heading: 'The route we recommend',
        paragraphs: [
          'Kanipakam lies south-west of Tirupati and Srikalahasti north-east, so the day loops out to one, back through Tirupati, and out to the other. We usually start early for Kanipakam, then drive to Srikalahasti in the afternoon.',
          'Many devotees prefer to visit Srikalahasti last: by a widely followed custom, after Rahu-Ketu pooja one should go straight home rather than visit other temples. If you would rather go to Srikalahasti first, the driver will plan the day that way.',
        ],
      },
      {
        heading: 'Practical tips',
        bullets: [
          'Start early to fit in both temples without rushing and to avoid the afternoon heat.',
          'Check darshan hours and pooja arrangements with each temple before you set out; they change on festival days.',
          'Vinayaka Chaturthi brings very large crowds to Kanipakam, and Maha Shivaratri to Srikalahasti. Mondays can also be busy at Srikalahasti.',
          'Wear traditional clothing and easy footwear, and carry water for the car.',
          'Combine the trip with Tirumala on separate days. Doing all three in one day is not practical.',
        ],
      },
    ],
    packageSlugs: ['kanipakam-srikalahasti-tour', 'custom-pilgrimage-itinerary'],
    guideSlugs: ['kanipakam-srikalahasti-day-trip-from-tirupati'],
    faqs: [
      { q: 'How far is Kanipakam from Tirupati?', a: 'About 70 km. The drive usually takes one and a half to two hours, depending on traffic and stops.' },
      { q: 'How far is Srikalahasti from Tirupati?', a: 'About 36 km, roughly an hour by car.' },
      { q: 'Can we do Srikalahasti first?', a: 'Yes. The driver will suggest the best order for your day.' },
      { q: 'Can we visit just one of the temples?', a: 'Yes. Tell us which one when you book and we will price a shorter trip.' },
    ],
    whatsappText: 'Hello, I would like a car from Tirupati to Kanipakam and Srikalahasti.',
  },
  {
    slug: 'tirupati-to-vellore-golden-temple',
    title: 'Tirupati to Vellore Golden Temple',
    metaTitle: 'Tirupati to Vellore Golden Temple by Car',
    metaDescription: 'Day trip from Tirupati to the Sripuram Golden Temple in Vellore by private car: about 120 km each way, visitor rules, the interstate permit and Vellore Fort.',
    eyebrow: 'Interstate day trip',
    lead: 'A day trip across the state border to the Sri Lakshmi Narayani Golden Temple at Sripuram, Vellore, with an optional stop at Vellore Fort. Pickup and drop at your hotel in Tirupati.',
    image: 'vellore-golden-temple',
    serviceType: 'Day tour',
    facts: [
      { label: 'Distance', value: 'About 120 km from Tirupati' },
      { label: 'At the temple', value: 'Allow 2 to 3 hours' },
      { label: 'Duration', value: 'Full day, with an early start' },
      { label: 'Border', value: 'Tamil Nadu interstate permit charges may apply' },
    ],
    sections: [
      {
        heading: 'About the Golden Temple',
        paragraphs: [
          'The Sri Lakshmi Narayani temple at Sripuram, on the southern edge of Vellore in Tamil Nadu, is dedicated to Goddess Lakshmi. The temple is covered in gold and set in landscaped gardens, approached along a long, star-shaped path. It is especially striking in the late afternoon and evening, when the gold catches the light.',
        ],
      },
      {
        heading: 'How the day works',
        bullets: [
          'Early-morning pickup from your hotel in Tirupati.',
          'Drive to Vellore, crossing into Tamil Nadu.',
          'Two to three hours at Sripuram, including the walk along the path.',
          'Optional stop at Vellore Fort if time allows.',
          'Drive back to Tirupati in the evening.',
        ],
      },
      {
        heading: 'Visitor rules at Sripuram',
        paragraphs: [
          'The temple has its own dress code and security rules, including restrictions on phones, cameras and bags. Rules can change, so please check the temple\'s current guidance before you travel. Modest, traditional clothing is the safest choice.',
        ],
      },
      {
        heading: 'Costs to know about',
        paragraphs: [
          'The trip includes an air-conditioned vehicle with driver, fuel and the driver allowance. The Tamil Nadu interstate permit or tax, parking and tolls, entry tickets and meals are extra, and we list them clearly when we confirm the price with you.',
        ],
      },
    ],
    packageSlugs: ['vellore-golden-temple-tour', 'outstation-travel', 'custom-pilgrimage-itinerary'],
    guideSlugs: ['plan-tirumala-trip-from-tirupati'],
    faqs: [
      { q: 'How far is the Vellore Golden Temple from Tirupati?', a: 'About 120 km. With the border crossing and traffic, plan for an early start and a full day.' },
      { q: 'Are there rules for visitors at Sripuram?', a: 'The temple has its own dress and security rules, including restrictions on phones. Please check them before you travel.' },
      { q: 'Is the interstate permit included?', a: 'No. Tamil Nadu permit or tax charges are extra and depend on the vehicle. We tell you the amount when we confirm the price.' },
      { q: 'Can we add other places in Vellore?', a: 'Yes. Vellore Fort is a common addition if time allows. Tell us what you would like to see when you book.' },
    ],
    whatsappText: 'Hello, I would like a car from Tirupati to the Vellore Golden Temple.',
  },
  {
    slug: 'tirupati-cab-booking',
    title: 'Cab booking and outstation travel from Tirupati',
    metaTitle: 'Tirupati Cab Booking & Outstation Taxi',
    metaDescription: 'Book a cab in Tirupati by the hour, or an outstation taxi to Chennai, Bengaluru, Kanchipuram or Srisailam. One-way drops or round trips with the same driver.',
    eyebrow: 'Local and outstation cabs',
    lead: 'A car with a driver for as long as you need it: a few hours around Tirupati for shopping, hospital visits or temples at your own pace, or a one-way drop or round trip anywhere in South India.',
    image: 'outstation-journey',
    serviceType: 'Taxi service',
    facts: [
      { label: 'Local cabs', value: '4-hour or 8-hour packages around Tirupati' },
      { label: 'Outstation', value: 'One-way drops and multi-day round trips' },
      { label: 'Popular routes', value: 'Chennai, Bengaluru, Kanchipuram, Srisailam' },
      { label: 'Vehicles', value: 'Sedan, SUV, Innova Crysta, Tempo Traveller' },
    ],
    sections: [
      {
        heading: 'Local cabs by the hour',
        paragraphs: [
          'Hire a cab with a driver for half a day or a full day around Tirupati. Use it for shopping, hospital or office visits, or for temples you want to see at your own pace without a fixed itinerary. Fuel within the package limits is included; extra kilometres and hours, parking and tolls are charged separately.',
        ],
      },
      {
        heading: 'Outstation travel',
        paragraphs: [
          'Travel from Tirupati to Chennai, Bengaluru, Kanchipuram, Srisailam and beyond. Choose a one-way drop, for example to catch a flight from Chennai, or a round trip over several days with the same driver throughout.',
        ],
        bullets: [
          'Tolls and interstate permits are extra and depend on the route and vehicle.',
          'On multi-day trips, a driver\'s night allowance applies for each night away.',
          'We confirm the full price, including these extras, before you travel.',
        ],
      },
      {
        heading: 'Airport and station transfers',
        paragraphs: [
          'We pick up and drop at Tirupati Airport, Tirupati railway station and Renigunta Junction. Share your train or flight number and the driver will adjust to your actual arrival time, even late at night.',
        ],
      },
      {
        heading: 'Which vehicle?',
        bullets: [
          'Sedan (Swift Dzire, Toyota Etios or similar): up to 4 passengers, 2 medium bags.',
          'SUV (Maruti Ertiga or similar): up to 6 passengers.',
          'Toyota Innova Crysta: up to 7 passengers, 3 medium bags, the most comfortable for long drives.',
          'Tempo Traveller: up to 12 passengers and 8 medium bags, for groups.',
        ],
      },
    ],
    packageSlugs: ['local-cab-booking', 'outstation-travel', 'airport-railway-transfers'],
    guideSlugs: ['tirupati-airport-railway-station-to-tirumala'],
    faqs: [
      { q: 'Can I book a cab for a few hours?', a: 'Yes. Local cabs come in 4-hour and 8-hour packages. Extra hours and kilometres are charged at the agreed rate.' },
      { q: 'Do you do one-way trips to Chennai or Bengaluru?', a: 'Yes. One-way drops and round trips are both available. Tell us your route and date and we will confirm the price.' },
      { q: 'Are tolls and permits included?', a: 'Tolls and interstate permits are extra on outstation trips. We include them in the price breakdown when we confirm.' },
      { q: 'What if my train is late?', a: 'Share your train or flight number when you book, and the driver will adjust to your actual arrival time.' },
    ],
    whatsappText: 'Hello, I would like to book a cab in Tirupati.',
  },
];

export const getLandingPage = (slug: string) => landingPages.find(p => p.slug === slug);
