/** 
 * A server-sent event.
 */
class ServerSentEvent {
  /**
   * Create a new server-sent event.
   *
   * @param {string} event The event name.
   * @param {string} data The event data.
   * @param {string} id The event ID.
   * @param {number} retry The retry time.
   */
  constructor(event, data, id, retry) {
    this.event = event;
    this.data = data;
    this.id = id;
    this.retry = retry;
  }

  /**
   * Convert the event to a string.
   */
  toString() {
    if (this.event === "output") {
      return this.data;
    }
    return "";
  }
}

/**
 * A stream of server-sent events.
 */
class Stream {
  /**
   * Create a new stream of server-sent events.
   *
   * @param {string} url The URL to connect to.
   * @param {object} options The fetch options.
   */
  constructor(url, options) {
    this.url = url;
    this.options = options;
  }

  async *[Symbol.asyncIterator]() {
    const response = await fetch(this.url, {
      ...this.options,
      headers: {
        Accept: "text/event-stream",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const reader = response.body.getReader();
    let event = null;
    let data = [];
    let lastEventId = null;
    let retry = null;

    const decode = (line) => {
      if (!line) {
        if (!event && !data.length && !lastEventId) {
          return null;
        }
        const sse = new ServerSentEvent(event, data.join("\n"), lastEventId);
        event = null;
        data = [];
        retry = null;
        return sse;
      }

      if (line.startsWith(":")) {
        return null;
      }

      const [field, value] = line.split(": ");
      if (field === "event") {
        event = value;
      } else if (field === "data") {
        data.push(value);
      } else if (field === "id") {
        lastEventId = value;
      }
      return null;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const decoder = new TextDecoder("utf-8");
      const text = decoder.decode(value);
      const lines = text.split("\n");

      for (const line of lines) {
        const sse = decode(line);
        if (sse) {
          if (sse.event === "error") {
            throw new Error(sse.data);
          }
          yield sse;
          if (sse.event === "done") {
            return;
          }
        }
      }
    }
  }
}

module.exports = { Stream, ServerSentEvent };