import { User } from "./user";
import { Event } from "./event";
import { Signup } from "./signup";

// Associations. Foreign-key column names match the underscored schema.
User.hasMany(Event, { foreignKey: "organizerId", as: "events" });
Event.belongsTo(User, { foreignKey: "organizerId", as: "organizer" });

Event.hasMany(Signup, { foreignKey: "eventId", as: "signups" });
Signup.belongsTo(Event, { foreignKey: "eventId", as: "event" });

User.hasMany(Signup, { foreignKey: "userId", as: "signups" });
Signup.belongsTo(User, { foreignKey: "userId", as: "user" });

export { User, Event, Signup };
