export async function asyncPool(limit, array, iteratorFn) {
  const ret = [];
  const executing = [];

  let i = 0;

  for (const item of array) {
    const currentIndex = i++;

    const p = Promise.resolve().then(() => iteratorFn(item, currentIndex));
    ret.push(p);

    if (limit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);

      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(ret);
}
