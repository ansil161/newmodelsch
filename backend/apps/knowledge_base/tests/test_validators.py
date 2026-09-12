from django.test import SimpleTestCase

from apps.knowledge_base.exceptions import UploadRejected
from apps.knowledge_base.upstream import snake_case
from apps.knowledge_base.validators import clean_tags, display_filename, upload_format, validate_source_url


class ValidatorTests(SimpleTestCase):
    def test_public_links_pass(self):
        for url in ("https://school.example/fees", "http://example.org/a?b=c", "https://[2606:4700::1111]/"):
            with self.subTest(url=url):
                self.assertEqual(validate_source_url(url), url)

    def test_internal_or_malformed_links_are_refused(self):
        cases = {
            "": "invalid_url",
            "javascript:alert(1)": "invalid_url",
            "file:///etc/passwd": "invalid_url",
            "https://a:b@example.org": "invalid_url",
            "http://10.0.0.8/": "blocked_url",
            "http://[::1]/": "blocked_url",
            "http://[::ffff:127.0.0.1]/": "blocked_url",
            "http://metadata.google.internal/": "blocked_url",
        }
        for url, code in cases.items():
            with self.subTest(url=url), self.assertRaises(UploadRejected) as caught:
                validate_source_url(url)
            self.assertEqual(caught.exception.default_code, code)

    def test_tags_are_trimmed_lower_cased_and_deduplicated(self):
        self.assertEqual(clean_tags(" Fees , fees,Term  Dates,, "), ["fees", "term dates"])
        with self.assertRaises(UploadRejected):
            clean_tags([f"tag{number}" for number in range(21)])

    def test_a_filename_never_carries_a_path(self):
        self.assertEqual(display_filename("../../etc/passwd"), "passwd")
        self.assertEqual(display_filename("C:\\Users\\me\\Fee Schedule.pdf"), "Fee_Schedule.pdf")

    def test_format_aliases(self):
        self.assertEqual(upload_format("notes.MARKDOWN"), "md")
        self.assertEqual(upload_format("report.PDF"), "pdf")

    def test_ai_service_keys_become_snake_case_values_untouched(self):
        self.assertEqual(
            snake_case({"traceId": 1, "denseTopK": [{"chunkId": "camelValue"}]}),
            {"trace_id": 1, "dense_top_k": [{"chunk_id": "camelValue"}]},
        )
