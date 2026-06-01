import { createFetcher, type TokenProvider } from "./fetcher";
import { AuthResource } from "./routes/auth";
import { BookingsResource } from "./routes/bookings";
import { ChatResource } from "./routes/chat";
import { FacilitiesResource } from "./routes/facilities";
import { OpenGamesResource } from "./routes/open-games";
import { PaymentsResource } from "./routes/payments";
import { ReviewsResource } from "./routes/reviews";
import { SlotsResource } from "./routes/slots";
import { UsersResource } from "./routes/users";
import { VendorsResource } from "./routes/vendors";

export class DomeApiClient {
  readonly auth: AuthResource;
  readonly users: UsersResource;
  readonly facilities: FacilitiesResource;
  readonly slots: SlotsResource;
  readonly bookings: BookingsResource;
  readonly payments: PaymentsResource;
  readonly vendors: VendorsResource;
  readonly reviews: ReviewsResource;
  readonly openGames: OpenGamesResource;
  readonly chat: ChatResource;

  constructor(baseUrl: string, getToken: TokenProvider = () => null) {
    const fetcher = createFetcher(baseUrl, getToken);
    this.auth = new AuthResource(fetcher);
    this.users = new UsersResource(fetcher);
    this.facilities = new FacilitiesResource(fetcher);
    this.slots = new SlotsResource(fetcher);
    this.bookings = new BookingsResource(fetcher);
    this.payments = new PaymentsResource(fetcher);
    this.vendors = new VendorsResource(fetcher);
    this.reviews = new ReviewsResource(fetcher);
    this.openGames = new OpenGamesResource(fetcher);
    this.chat = new ChatResource(fetcher);
  }
}
