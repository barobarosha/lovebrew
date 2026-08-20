import { Nav } from "@/sections/Nav";
import { Hero } from "@/sections/Hero";
import { Services } from "@/sections/Services";
import { LoftSection } from "@/sections/LoftSection";
import { BookingCalendar } from "@/sections/BookingCalendar";
import { CoworkingSection, KidsSection } from "@/sections/CoworkKids";
import { MenuSection } from "@/sections/MenuSection";
import { EventsSection } from "@/sections/EventsSection";
import { Footer } from "@/sections/Footer";
import { BookingProvider } from "@/components/booking/BookingProvider";

export default function Home() {
  return (
    <BookingProvider>
      <Nav />
      <main>
        <Hero />
        <Services />
        <LoftSection />
        <BookingCalendar />
        <CoworkingSection />
        <KidsSection />
        <MenuSection />
        <EventsSection />
      </main>
      <Footer />
    </BookingProvider>
  );
}
