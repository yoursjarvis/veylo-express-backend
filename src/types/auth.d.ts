declare namespace Express {
  export interface Request {
    auth?: {
      user: {
        id: number | string;
        email: string;
        name?: string;
        firstName?: string;
        lastName?: string;
        emailVerified?: boolean;
      };
      session: {
        token: string;
        expiresAt: string | Date;
        id?: number | string;
      };
    };
  }
}

