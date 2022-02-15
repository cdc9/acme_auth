const Sequelize = require('sequelize');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { STRING } = Sequelize;
const config = {
  logging: false,
};

if (process.env.LOGGING) {
  delete config.logging;
}
const conn = new Sequelize(
  process.env.DATABASE_URL || 'postgres://localhost/acme_db',
  config
);

const User = conn.define('user', {
  username: STRING,
  password: STRING,
});

User.byToken = async (token) => {
  try {
    const payload = jwt.verify(token, process.env.JWT);
    if (payload) {
      const user = await User.findByPk(payload.userId);
      return user;
    }
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  } catch (ex) {
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  }
};

User.authenticate = async ({ username, password }) => {
  const user = await User.findOne({
    where: {
      username,
      //password,
    },
  });
  if (bcrypt.compare(password, user.password)) {
    return jwt.sign({ userId: user.id }, process.env.JWT);
  }
  // Load hash from your password DB.
  const error = Error('bad credentials');
  error.status = 401;
  throw error;
};

User.beforeCreate(async (user) => {
  const hashedPassword = await bcrypt.hash(user.password, 2);
  user.password = hashedPassword;
});

const Note = conn.define('note', {
  text: STRING,
});

User.hasMany(Note);
Note.belongsTo(User);

const syncAndSeed = async () => {
  await conn.sync({ force: true });
  const credentials = [
    { username: 'lucy', password: 'lucy_pw' },
    { username: 'moe', password: 'moe_pw' },
    { username: 'larry', password: 'larry_pw' },
  ];
  const [lucy, moe, larry] = await Promise.all(
    credentials.map((credential) => User.create(credential))
  );

  const newNotes = [
    { text: 'Lucy Im home' },
    { text: 'moes tavern!' },
    { text: 'larry david sells crypto' },
  ];
  const [lucyNote, moeNote, larryNote] = await Promise.all(
    newNotes.map((note) => Note.create(note))
  );
  await lucy.setNotes(lucyNote);
  await moe.setNotes(moeNote);
  await larry.setNotes(larryNote);

  return {
    users: {
      lucy,
      moe,
      larry,
    },
    notes: {
      lucyNote,
      moeNote,
      larryNote,
    },
  };
};

module.exports = {
  syncAndSeed,
  models: {
    User,
    Note,
  },
};
