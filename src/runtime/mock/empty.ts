const empty = Object.freeze(
  Object.create(null, {
    __mock__: { get: () => true },
  }),
)

export default empty
