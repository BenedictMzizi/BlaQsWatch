
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

import {
  ensureConversationParticipant,
  getConversationList,
  getConversationMessages,
  markConversationRead,
  sendMessage,
  updateSupportStatus
} from '../../services/messagingService';

import '../../styles/Messages.css';

import {
  ChatBubbleLeftRightIcon,
  LifebuoyIcon,
  PaperAirplaneIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_for_company: 'Waiting for company',
  resolved: 'Resolved'
};

function formatTime(value) {
  if (!value) return '';

  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDate(value) {
  if (!value) return '';

  return new Date(value).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export default function PlatformMessages() {
  const [user, setUser] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);

  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const currentUserId = user?.id;

  const loadConversations = useCallback(async () => {
    if (!currentUserId) return;

    const result = await getConversationList({
      supportOnly: true,
      currentUserId
    });

    setConversations(result);

    setSelectedConversation(current => {
      if (!current) return null;

      return result.find(item => item.id === current.id) || null;
    });
  }, [currentUserId]);

  const loadMessages = useCallback(async conversationId => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    setMessagesLoading(true);

    try {
      const result = await getConversationMessages(conversationId);
      setMessages(result);
    } catch (loadError) {
      console.error('Unable to load support messages:', loadError);
      setError(loadError.message || 'Unable to load messages.');
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initialise() {
      setLoading(true);
      setError('');

      try {
        const { data, error: userError } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!data.user) {
          throw new Error('Your session has expired. Please sign in again.');
        }

        if (!active) return;

        setUser(data.user);
      } catch (loadError) {
        if (active) {
          setError(loadError.message || 'Unable to load your account.');
          setLoading(false);
        }
      }
    }

    initialise();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    let active = true;

    async function load() {
      try {
        const result = await getConversationList({
          supportOnly: true,
          currentUserId
        });

        if (active) setConversations(result);
      } catch (loadError) {
        console.error('Support inbox loading failed:', loadError);

        if (active) {
          setError(
            loadError.message || 'Unable to load the support inbox.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return undefined;

    const channel = supabase
      .channel('platform-support-inbox')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_messages'
        },
        async payload => {
          const conversationId =
            payload.new?.conversation_id ||
            payload.old?.conversation_id;

          if (conversationId === selectedConversation?.id) {
            await loadMessages(conversationId);
          }

          try {
            await loadConversations();
          } catch (refreshError) {
            console.error('Unable to refresh support inbox:', refreshError);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        loadConversations
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    currentUserId,
    selectedConversation?.id,
    loadConversations,
    loadMessages
  ]);

  useEffect(() => {
    if (!selectedConversation || !currentUserId) {
      setMessages([]);
      return;
    }

    let active = true;

    async function openSupportConversation() {
      setError('');

      try {
        // Adds the current platform administrator as a participant.
        // The support participant SQL correction must be installed first.
        await ensureConversationParticipant(
          selectedConversation.id,
          currentUserId
        );

        await markConversationRead(
          selectedConversation.id,
          currentUserId
        );

        const result = await getConversationMessages(
          selectedConversation.id
        );

        if (active) {
          setMessages(result);
          await loadConversations();
        }
      } catch (loadError) {
        console.error('Unable to open support conversation:', loadError);

        if (active) {
          setError(
            loadError.message || 'Unable to open this support conversation.'
          );
        }
      }
    }

    openSupportConversation();

    return () => {
      active = false;
    };
  }, [selectedConversation?.id, currentUserId, loadConversations]);

  async function handleSendMessage(event) {
    event.preventDefault();

    if (!draft.trim() || !selectedConversation || sending) return;

    setSending(true);
    setError('');

    try {
      await sendMessage({
        conversationId: selectedConversation.id,
        senderId: currentUserId,
        content: draft
      });

      setDraft('');

      await Promise.all([
        loadMessages(selectedConversation.id),
        loadConversations()
      ]);

      await markConversationRead(
        selectedConversation.id,
        currentUserId
      );
    } catch (sendError) {
      console.error('Support reply failed:', sendError);
      setError(sendError.message || 'Unable to send your reply.');
    } finally {
      setSending(false);
    }
  }

  async function handleStatusChange(event) {
    const nextStatus = event.target.value;

    if (!selectedConversation || updatingStatus) return;

    setUpdatingStatus(true);
    setError('');

    try {
      await updateSupportStatus(
        selectedConversation.id,
        nextStatus
      );

      await loadConversations();
    } catch (statusError) {
      console.error('Support status update failed:', statusError);
      setError(statusError.message || 'Unable to update support status.');
    } finally {
      setUpdatingStatus(false);
    }
  }

  const unreadTotal = conversations.reduce(
    (total, conversation) => total + (conversation.unread_count || 0),
    0
  );

  if (loading) {
    return (
      <div className="messages-loading">
        <ArrowPathIcon />
        <span>Loading support inbox...</span>
      </div>
    );
  }

  return (
    <section className="messages-page">
      <div className="messages-heading">
        <div>
          <span className="messages-eyebrow">PLATFORM OPERATIONS</span>
          <h1>Support inbox</h1>
          <p>
            Manage support conversations from BlaQsWatch companies.
          </p>
        </div>

        <div className="platform-support-summary">
          <span>{conversations.length} requests</span>
          <span>{unreadTotal} unread</span>
        </div>
      </div>

      {error && (
        <div className="messages-error" role="alert">
          {error}
        </div>
      )}

      <div className="messages-workspace platform-messages-workspace">
        <aside className="messages-inbox">
          <div className="messages-inbox-heading">
            <div>
              <strong>Support requests</strong>
              <small>All company support conversations</small>
            </div>
          </div>

          <div className="messages-conversation-list">
            {conversations.length === 0 ? (
              <div className="messages-empty-list">
                <LifebuoyIcon />
                <strong>No support requests</strong>
                <span>New company support requests will appear here.</span>
              </div>
            ) : (
              conversations.map(conversation => (
                <button
                  type="button"
                  key={conversation.id}
                  className={`messages-conversation-item ${
                    selectedConversation?.id === conversation.id
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() => setSelectedConversation(conversation)}
                >
                  <div className="messages-conversation-avatar">
                    <LifebuoyIcon />
                  </div>

                  <div className="messages-conversation-info">
                    <div className="messages-conversation-topline">
                      <strong>
                        {conversation.title || 'Support request'}
                      </strong>

                      <small>
                        {formatDate(
                          conversation.last_message_at ||
                          conversation.created_at
                        )}
                      </small>
                    </div>

                    <p>{conversation.business_name || 'Company'}</p>

                    <div className="messages-conversation-bottomline">
                      <span>
                        {STATUS_LABELS[conversation.support_status] ||
                          'Open'}
                      </span>

                      {conversation.unread_count > 0 && (
                        <b>{conversation.unread_count}</b>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="messages-chat">
          {!selectedConversation ? (
            <div className="messages-chat-empty">
              <div className="messages-empty-icon">
                <ChatBubbleLeftRightIcon />
              </div>
              <h2>Customer support</h2>
              <p>
                Select a support request to review and respond.
              </p>
            </div>
          ) : (
            <>
              <header className="messages-chat-header platform-support-header">
                <div className="messages-conversation-avatar">
                  <LifebuoyIcon />
                </div>

                <div className="platform-support-title">
                  <strong>
                    {selectedConversation.title || 'Support request'}
                  </strong>
                  <small>
                    {selectedConversation.business_name || 'Company'} ·
                    {' '}
                    {formatDate(selectedConversation.created_at)}
                  </small>
                </div>

                <label className="platform-status-control">
                  <span>Status</span>
                  <select
                    value={selectedConversation.support_status || 'open'}
                    onChange={handleStatusChange}
                    disabled={updatingStatus}
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </header>

              <div className="messages-chat-history">
                {messagesLoading ? (
                  <div className="messages-loading">
                    <ArrowPathIcon />
                    <span>Loading conversation...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="messages-chat-empty">
                    <p>No messages in this support request yet.</p>
                  </div>
                ) : (
                  messages.map(message => {
                    const ownMessage =
                      message.sender_id === currentUserId;

                    return (
                      <div
                        key={message.id}
                        className={`messages-message-row ${
                          ownMessage ? 'own' : ''
                        }`}
                      >
                        <div className="messages-message">
                          {!ownMessage && (
                            <strong>
                              {message.sender?.full_name ||
                                message.sender?.email ||
                                'Company member'}
                            </strong>
                          )}

                          {ownMessage && (
                            <strong>BlaQsWatch Support</strong>
                          )}

                          <p>{message.content}</p>
                          <small>{formatTime(message.created_at)}</small>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form
                className="messages-reply"
                onSubmit={handleSendMessage}
              >
                <textarea
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  placeholder="Reply to the company..."
                  rows={2}
                  maxLength={10000}
                  onKeyDown={event => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />

                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  aria-label="Send reply"
                  title="Send reply"
                >
                  <PaperAirplaneIcon />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
