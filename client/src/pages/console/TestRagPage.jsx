import { useSearchParams } from 'react-router-dom';
import { ChatPanel } from '@/components/knowledge-base/ChatPanel';
import { Segmented } from '@/components/knowledge-base/ListControls';
import { RagDiagnosticsPanel } from '@/components/knowledge-base/RagDiagnosticsPanel';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';
import { usePageMeta } from '@/hooks/usePageMeta';

const MODES = [
  { value: 'diagnose', label: 'Diagnose', icon: 'flask' },
  { value: 'chat', label: 'Chat', icon: 'message' },
];

/**
 * Test RAG: one question, fully explained — or a conversation, as the
 * chatbot would hold it. Both stay mounted, so switching between them keeps
 * the last result and the conversation.
 */
export function TestRagPage() {
  const { knowledgeBase } = useKnowledgeBase();
  usePageMeta({ title: `Test RAG - ${knowledgeBase.name}`, description: 'Test retrieval and answers for this knowledge base.' });
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'chat' ? 'chat' : 'diagnose';

  return (
    <div className="c-stack">
      <div className="kb-toolbar">
        <Segmented
          label="Test mode"
          options={MODES}
          value={mode}
          onChange={(value) => setParams(value === 'chat' ? { mode: 'chat' } : {}, { replace: true })}
        />
        {!knowledgeBase.chatEnabled ? (
          <p className="c-small c-muted kb-toolbar__note">Not in the chatbot yet. Tests here search it anyway.</p>
        ) : null}
      </div>
      <div hidden={mode !== 'diagnose'}>
        <RagDiagnosticsPanel knowledgeBase={knowledgeBase} />
      </div>
      <div hidden={mode !== 'chat'}>
        <ChatPanel knowledgeBaseId={knowledgeBase.id} />
      </div>
    </div>
  );
}
